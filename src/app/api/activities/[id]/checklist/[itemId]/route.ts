import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

const PatchItemSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  done: z.boolean().optional(),
});

async function loadItem(activityId: string, itemId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) throw new NotFoundError("Activity not found.");

  const item = await prisma.checklistItem.findFirst({ where: { id: itemId, activityId } });
  if (!item) throw new NotFoundError("Checklist item not found.");

  return { activity, item };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id: activityId, itemId } = await params;
    const { activity } = await loadItem(activityId, itemId);

    await loadTrackerForViewer(activity.trackerId, userId);
    await requireTrackerGrant(userId, activity.trackerId, "tracker.activities", "EDIT");

    const body = PatchItemSchema.parse(await request.json());
    const item = await prisma.checklistItem.update({ where: { id: itemId }, data: body });

    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id: activityId, itemId } = await params;
    const { activity } = await loadItem(activityId, itemId);

    await loadTrackerForViewer(activity.trackerId, userId);
    await requireTrackerGrant(userId, activity.trackerId, "tracker.activities", "EDIT");

    await prisma.checklistItem.delete({ where: { id: itemId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
