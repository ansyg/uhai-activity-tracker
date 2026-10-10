import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; assigneeId: string }> }
) {
  try {
    const callerId = await requireUserId();
    const { id: activityId, assigneeId } = await params;

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundError("Activity not found.");

    await loadTrackerForViewer(activity.trackerId, callerId);
    await requireTrackerGrant(callerId, activity.trackerId, "tracker.activities", "EDIT");

    const assignee = await prisma.activityAssignee.findFirst({ where: { id: assigneeId, activityId } });
    if (!assignee) throw new NotFoundError("Assignee not found.");

    await prisma.activityAssignee.delete({ where: { id: assigneeId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
