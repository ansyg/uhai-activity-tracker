import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

/** Revokes a pending invite — same permission as sending one (tracker.members:MANAGE). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const callerId = await requireUserId();
    const { id: trackerId, inviteId } = await params;
    await requireTrackerGrant(callerId, trackerId, "tracker.members", "MANAGE");

    const invite = await prisma.trackerInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.trackerId !== trackerId) throw new NotFoundError("Invite not found.");

    await prisma.trackerInvite.update({ where: { id: inviteId }, data: { status: "REVOKED" } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
