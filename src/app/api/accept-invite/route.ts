import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { createNotification } from "@/lib/notifications/create";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const token = request.nextUrl.searchParams.get("token");
    if (!token) throw new BadRequestError("Missing invite token.");

    const invite = await prisma.trackerInvite.findUnique({ where: { token }, include: { tracker: true } });
    if (!invite) throw new NotFoundError("Invite not found.");
    if (invite.status !== "PENDING") throw new BadRequestError(`This invite has already been ${invite.status.toLowerCase()}.`);
    if (invite.expiresAt < new Date()) throw new BadRequestError("This invite has expired.");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invite.email) {
      throw new BadRequestError(`This invite was sent to ${invite.email} — sign in with that exact email to accept it.`);
    }

    const [membership] = await prisma.$transaction([
      prisma.trackerMembership.upsert({
        where: { trackerId_userId: { trackerId: invite.trackerId, userId } },
        update: { status: "APPROVED", roleId: invite.roleId, decidedAt: new Date() },
        create: {
          trackerId: invite.trackerId,
          userId,
          roleId: invite.roleId,
          status: "APPROVED",
          decidedAt: new Date(),
        },
      }),
      prisma.trackerInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } }),
    ]);

    await createNotification(invite.invitedById, "INVITE_ACCEPTED", {
      trackerId: invite.trackerId,
      trackerName: invite.tracker.name,
      acceptedBy: userId,
    });

    return NextResponse.json({ membership, tracker: invite.tracker });
  } catch (error) {
    return handleApiError(error);
  }
}
