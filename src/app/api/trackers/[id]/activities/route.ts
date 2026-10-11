import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { statusFromPercent } from "@/lib/activities/status";
import { isPlausibleIsoDateTime } from "@/lib/dates";
import { handleApiError } from "@/lib/api/errors";
import { syncActivityToCalendar } from "@/lib/calendar/google-calendar";
import type { ActivityStatus } from "@prisma/client";

const isoDate = z
  .string()
  .datetime()
  .refine(isPlausibleIsoDateTime, "Date must be between 1970 and 2100.");

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    await loadTrackerForViewer(trackerId, userId);

    const phaseId = request.nextUrl.searchParams.get("phaseId") ?? undefined;
    const status = request.nextUrl.searchParams.get("status") as ActivityStatus | null;

    const activities = await prisma.activity.findMany({
      where: { trackerId, phaseId, status: status ?? undefined },
      include: {
        phase: { select: { id: true, name: true, sequence: true } },
        module: { select: { id: true, name: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
      orderBy: [{ phase: { sequence: "asc" } }, { createdAt: "asc" }],
    });

    return NextResponse.json({ activities });
  } catch (error) {
    return handleApiError(error);
  }
}

const CreateActivitySchema = z.object({
  phaseId: z.string().min(1),
  moduleId: z.string().min(1).optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(4000).optional(),
  statusPercent: z.number().int().min(0).max(100).default(0),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  assigneeUserIds: z.array(z.string()).optional(),
  roleTags: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    await loadTrackerForViewer(trackerId, userId);
    await requireTrackerGrant(userId, trackerId, "tracker.activities", "CREATE");

    const body = CreateActivitySchema.parse(await request.json());

    const phase = await prisma.phase.findFirst({ where: { id: body.phaseId, trackerId } });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found on this tracker." }, { status: 400 });
    }

    const activity = await prisma.activity.create({
      data: {
        trackerId,
        phaseId: body.phaseId,
        moduleId: body.moduleId,
        title: body.title,
        description: body.description,
        statusPercent: body.statusPercent,
        status: statusFromPercent(body.statusPercent),
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        assignees: {
          create: [
            ...(body.assigneeUserIds ?? []).map((userId) => ({ userId })),
            ...(body.roleTags ?? []).map((roleTag) => ({ roleTag })),
          ],
        },
        history: {
          create: { changedById: userId, field: "created", newValue: body.title, source: "app" },
        },
      },
      include: { assignees: true },
    });

    await syncActivityToCalendar(activity, userId, request.nextUrl.origin).catch((err) =>
      console.error("Calendar sync failed:", err)
    );

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
