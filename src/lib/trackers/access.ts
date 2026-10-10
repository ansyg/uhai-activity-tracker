import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/api/errors";
import type { Tracker, TrackerMembership } from "@prisma/client";

export interface TrackerAccess {
  tracker: Tracker;
  membership: TrackerMembership | null;
  isOwner: boolean;
  isApprovedMember: boolean;
}

/**
 * Loads a tracker and the caller's relationship to it. A PRIVATE tracker
 * is invisible to non-members (ARCHITECTURE.md §3), so this throws 404
 * rather than 403 for them — same response whether the tracker doesn't
 * exist or the caller simply can't see it.
 */
export async function loadTrackerForViewer(trackerId: string, userId: string): Promise<TrackerAccess> {
  const tracker = await prisma.tracker.findUnique({ where: { id: trackerId } });
  if (!tracker) throw new NotFoundError("Tracker not found.");

  const membership = await prisma.trackerMembership.findUnique({
    where: { trackerId_userId: { trackerId, userId } },
  });

  const isOwner = tracker.ownerId === userId;
  const isApprovedMember = membership?.status === "APPROVED";

  if (tracker.visibility === "PRIVATE" && !isOwner && !isApprovedMember) {
    throw new NotFoundError("Tracker not found.");
  }

  return { tracker, membership, isOwner, isApprovedMember };
}
