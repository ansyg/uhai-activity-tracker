import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

const PatchMembershipSchema = z.object({
  roleId: z.string().min(1),
});

async function loadApprovedMembership(trackerId: string, targetUserId: string) {
  const tracker = await prisma.tracker.findUnique({ where: { id: trackerId }, select: { ownerId: true } });
  if (!tracker) throw new NotFoundError("Tracker not found.");
  if (tracker.ownerId === targetUserId) {
    throw new BadRequestError("The tracker owner's access can't be changed here.");
  }

  const membership = await prisma.trackerMembership.findUnique({
    where: { trackerId_userId: { trackerId, userId: targetUserId } },
  });
  if (!membership || membership.status !== "APPROVED") throw new NotFoundError("Member not found.");
  return membership;
}

/** Changes an already-approved member's role — everyone but the tracker owner is eligible. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const callerId = await requireUserId();
    const { id: trackerId, userId: targetUserId } = await params;
    await requireTrackerGrant(callerId, trackerId, "tracker.members", "MANAGE");
    await loadApprovedMembership(trackerId, targetUserId);

    const { roleId } = PatchMembershipSchema.parse(await request.json());
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new BadRequestError("Unknown role.");

    const membership = await prisma.trackerMembership.update({
      where: { trackerId_userId: { trackerId, userId: targetUserId } },
      data: { roleId },
    });

    return NextResponse.json({ membership, roleName: role.name });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Removes an approved member from the tracker (soft — keeps the row as REMOVED so they can re-request to join a public tracker later). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const callerId = await requireUserId();
    const { id: trackerId, userId: targetUserId } = await params;
    await requireTrackerGrant(callerId, trackerId, "tracker.members", "MANAGE");
    await loadApprovedMembership(trackerId, targetUserId);

    await prisma.trackerMembership.update({
      where: { trackerId_userId: { trackerId, userId: targetUserId } },
      data: { status: "REMOVED", decidedAt: new Date(), decidedById: callerId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
