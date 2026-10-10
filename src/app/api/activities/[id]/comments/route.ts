import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

const CreateCommentSchema = z.object({ body: z.string().min(1).max(4000) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: activityId } = await params;

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundError("Activity not found.");

    await loadTrackerForViewer(activity.trackerId, userId);
    await requireTrackerGrant(userId, activity.trackerId, "tracker.activities", "VIEW");

    const { body } = CreateCommentSchema.parse(await request.json());
    const comment = await prisma.comment.create({
      data: { activityId, userId, body },
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
