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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invite.email) {
      throw new BadRequestError(`This invite was sent to ${invite.email} — sign in with that exact email to accept it.`);
    }

    // Already resolved on a previous visit (including an auto-accept once the
    // account was approved, see the subscriptionStatus branch in
    // users/[id]/route.ts) — idempotent instead of erroring on a second click.
    if (invite.status === "ACCEPTED") {
      const membership = await prisma.trackerMembership.findUnique({
        where: { trackerId_userId: { trackerId: invite.trackerId, userId } },
      });
      if (membership) {
        return NextResponse.json({ status: "accepted", membership, tracker: invite.tracker });
      }
      throw new BadRequestError("This invite has already been accepted.");
    }
    if (invite.status !== "PENDING") throw new BadRequestError(`This invite has already been ${invite.status.toLowerCase()}.`);
    if (invite.expiresAt < new Date()) throw new BadRequestError("This invite has expired.");

    // A not-yet-approved account can't join a tracker yet — leave the invite
    // PENDING so it auto-completes the moment a Platform Admin approves them,
    // instead of dead-ending here with no way back in.
    if (user.subscriptionStatus !== "APPROVED") {
      return NextResponse.json({ status: "pending-approval", tracker: invite.tracker });
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

    return NextResponse.json({ status: "accepted", membership, tracker: invite.tracker });
  } catch (error) {
    return handleApiError(error);
  }
}
