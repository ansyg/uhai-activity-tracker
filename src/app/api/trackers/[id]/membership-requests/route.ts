import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { createNotifications } from "@/lib/notifications/create";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

/** Subscribe: "Request to join" on a tracker (ARCHITECTURE.md §3.3). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;

    const tracker = await prisma.tracker.findUnique({ where: { id: trackerId } });
    if (!tracker) throw new NotFoundError("Tracker not found.");
    if (tracker.visibility !== "PUBLIC") {
      throw new BadRequestError("This tracker is private — ask its owner for an invite.");
    }
    if (tracker.ownerId === userId) {
      throw new BadRequestError("You already own this tracker.");
    }

    const existing = await prisma.trackerMembership.findUnique({
      where: { trackerId_userId: { trackerId, userId } },
    });
    if (existing && existing.status !== "REMOVED" && existing.status !== "REJECTED") {
      throw new BadRequestError(`You already have a ${existing.status.toLowerCase()} request for this tracker.`);
    }

    const viewerRole = await prisma.role.findUnique({ where: { name: "Viewer" } });
    if (!viewerRole) throw new BadRequestError("RBAC is not seeded — run `npm run seed` first.");

    const membership = await prisma.trackerMembership.upsert({
      where: { trackerId_userId: { trackerId, userId } },
      update: { status: "PENDING", roleId: viewerRole.id, requestedAt: new Date(), decidedAt: null, decidedById: null },
      create: { trackerId, userId, roleId: viewerRole.id, status: "PENDING" },
    });

    const approvers = await prisma.trackerMembership.findMany({
      where: { trackerId, status: "APPROVED", role: { name: { in: ["Owner", "Admin"] } } },
      select: { userId: true },
    });
    const approverIds = [...new Set([tracker.ownerId, ...approvers.map((a) => a.userId)])];

    await createNotifications(approverIds, "JOIN_REQUESTED", {
      trackerId,
      trackerName: tracker.name,
      requesterId: userId,
    });

    return NextResponse.json({ membership }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
