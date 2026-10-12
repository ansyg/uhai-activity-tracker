import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

const CreateItemSchema = z.object({ text: z.string().min(1).max(500) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: activityId } = await params;

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundError("Activity not found.");

    await loadTrackerForViewer(activity.trackerId, userId);
    await requireTrackerGrant(userId, activity.trackerId, "tracker.activities", "EDIT");

    const { text } = CreateItemSchema.parse(await request.json());

    const last = await prisma.checklistItem.findFirst({ where: { activityId }, orderBy: { sequence: "desc" } });
    const item = await prisma.checklistItem.create({
      data: { activityId, text, sequence: (last?.sequence ?? -1) + 1 },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
