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
      // Not an error — the frontend shows this as a distinct outcome with a
      // "sign out and try again" action, not a dead-end message (ARCHITECTURE.md
      // §3.4: the recipient is very likely signed in under their everyday
      // account, not the one the invite names).
      return NextResponse.json({
        status: "wrong-account",
        expectedEmail: invite.email,
        currentEmail: user?.email ?? null,
        tracker: invite.tracker,
      });
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
    // A stale link (revoked by a resend, or past its own expiry) shouldn't
    // dead-end someone who has a fresher invite waiting — e.g. an owner using
    // "Resend invite" revokes the old token and issues a new one, but the
    // recipient may still have the old email/link open. Only reachable here
    // once we already know the signed-in email matches the invite, so this
    // can't be used to probe for someone else's active invite.
    if (invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      const fresher = await prisma.trackerInvite.findFirst({
        where: { trackerId: invite.trackerId, email: invite.email, status: "PENDING", expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });
      if (fresher) {
        return NextResponse.json({ status: "superseded", newToken: fresher.token, tracker: invite.tracker });
      }
      if (invite.status !== "PENDING") {
        throw new BadRequestError(
          `This invite has already been ${invite.status.toLowerCase()}. Ask the tracker owner to send a new one.`
        );
      }
      throw new BadRequestError("This invite has expired. Ask the tracker owner to send a new one.");
    }

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
