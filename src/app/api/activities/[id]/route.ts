import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { statusFromPercent } from "@/lib/activities/status";
import { isPlausibleIsoDateTime } from "@/lib/dates";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

const isoDate = z
  .string()
  .datetime()
  .refine(isPlausibleIsoDateTime, "Date must be between 1970 and 2100.");

const PatchActivitySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(4000).nullable().optional(),
  moduleId: z.string().nullable().optional(),
  statusPercent: z.number().int().min(0).max(100).optional(),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
});

const TRACKED_FIELDS = ["title", "description", "moduleId", "statusPercent", "status", "startDate", "endDate"] as const;

function serializeForHistory(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        phase: { select: { id: true, name: true, sequence: true } },
        module: { select: { id: true, name: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
        comments: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
        history: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!activity) throw new NotFoundError("Activity not found.");

    await loadTrackerForViewer(activity.trackerId, userId);

    return NextResponse.json({ activity });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const existing = await prisma.activity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Activity not found.");

    await loadTrackerForViewer(existing.trackerId, userId);
    await requireTrackerGrant(userId, existing.trackerId, "tracker.activities", "EDIT");

    const body = PatchActivitySchema.parse(await request.json());

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.moduleId !== undefined) data.moduleId = body.moduleId;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.statusPercent !== undefined) {
      data.statusPercent = body.statusPercent;
      data.status = statusFromPercent(body.statusPercent);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.activity.update({ where: { id }, data });

      const historyRows = TRACKED_FIELDS.filter(
        (field) => field in data && serializeForHistory((existing as never)[field]) !== serializeForHistory((result as never)[field])
      ).map((field) => ({
        activityId: id,
        changedById: userId,
        field,
        oldValue: serializeForHistory((existing as never)[field]),
        newValue: serializeForHistory((result as never)[field]),
        source: "app",
      }));

      if (historyRows.length > 0) {
        await tx.activityHistory.createMany({ data: historyRows });
      }

      return result;
    });

    return NextResponse.json({ activity: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const existing = await prisma.activity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Activity not found.");

    await loadTrackerForViewer(existing.trackerId, userId);
    await requireTrackerGrant(userId, existing.trackerId, "tracker.activities", "DELETE");

    // Children (assignees, comments, history, calendar links) don't block
    // deletion — Prisma cascades aren't declared for them in the schema, so
    // clear them explicitly before the activity itself.
    await prisma.$transaction([
      prisma.activityAssignee.deleteMany({ where: { activityId: id } }),
      prisma.comment.deleteMany({ where: { activityId: id } }),
      prisma.activityHistory.deleteMany({ where: { activityId: id } }),
      prisma.calendarEventMap.deleteMany({ where: { activityId: id } }),
      prisma.activity.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
