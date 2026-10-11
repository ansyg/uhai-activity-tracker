import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { isPlausibleIsoDateTime } from "@/lib/dates";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { tracker, membership, isOwner } = await loadTrackerForViewer(id, userId);

    const [owner, systems, phaseCount, activityCount] = await Promise.all([
      prisma.user.findUnique({ where: { id: tracker.ownerId }, select: { id: true, name: true, email: true } }),
      prisma.trackerSystem.findMany({ where: { trackerId: tracker.id }, include: { system: true } }),
      prisma.phase.count({ where: { trackerId: tracker.id } }),
      prisma.activity.count({ where: { trackerId: tracker.id } }),
    ]);

    return NextResponse.json({
      tracker: {
        ...tracker,
        owner,
        systems: systems.map((link) => ({ system: link.system, role: link.role })),
        phaseCount,
        activityCount,
      },
      myMembership: membership,
      isOwner,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const isoDate = z
  .string()
  .datetime()
  .refine(isPlausibleIsoDateTime, "Date must be between 1970 and 2100.");

const PatchTrackerSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  description: z.string().max(4000).nullable().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
  calendarSyncEnabled: z.boolean().optional(),
});

/** Owner/Admin can edit the tracker's own settings — name, description, visibility, its planned start/end, and Calendar sync. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    await loadTrackerForViewer(trackerId, userId);
    await requireTrackerGrant(userId, trackerId, "tracker.overview", "EDIT");

    const body = PatchTrackerSchema.parse(await request.json());
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.visibility !== undefined) data.visibility = body.visibility;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.calendarSyncEnabled !== undefined) data.calendarSyncEnabled = body.calendarSyncEnabled;

    const tracker = await prisma.tracker.update({ where: { id: trackerId }, data });

    return NextResponse.json({ tracker });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Owner only — removing a tracker is irreversible, so it's gated by its own DELETE action, not just EDIT. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    await loadTrackerForViewer(trackerId, userId);
    await requireTrackerGrant(userId, trackerId, "tracker.overview", "DELETE");

    const tracker = await prisma.tracker.findUnique({ where: { id: trackerId } });
    if (!tracker) throw new NotFoundError("Tracker not found.");

    const activityIds = (await prisma.activity.findMany({ where: { trackerId }, select: { id: true } })).map(
      (a) => a.id
    );

    await prisma.$transaction([
      prisma.activityHistory.deleteMany({ where: { activityId: { in: activityIds } } }),
      prisma.comment.deleteMany({ where: { activityId: { in: activityIds } } }),
      prisma.attachment.deleteMany({ where: { activityId: { in: activityIds } } }),
      prisma.calendarEventMap.deleteMany({ where: { activityId: { in: activityIds } } }),
      prisma.activityAssignee.deleteMany({ where: { activityId: { in: activityIds } } }),
      prisma.activity.deleteMany({ where: { trackerId } }),
      prisma.phase.deleteMany({ where: { trackerId } }),
      prisma.trackerSystem.deleteMany({ where: { trackerId } }),
      prisma.trackerInvite.deleteMany({ where: { trackerId } }),
      prisma.trackerMembership.deleteMany({ where: { trackerId } }),
      prisma.tracker.delete({ where: { id: trackerId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
