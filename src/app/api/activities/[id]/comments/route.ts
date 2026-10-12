import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { createNotifications } from "@/lib/notifications/create";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

const CreateCommentSchema = z.object({
  body: z.string().min(1).max(4000),
  mentionedUserIds: z.array(z.string()).max(50).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: activityId } = await params;

    const activity = await prisma.activity.findUnique({ where: { id: activityId }, include: { tracker: { select: { name: true } } } });
    if (!activity) throw new NotFoundError("Activity not found.");

    await loadTrackerForViewer(activity.trackerId, userId);
    await requireTrackerGrant(userId, activity.trackerId, "tracker.activities", "VIEW");

    const { body, mentionedUserIds } = CreateCommentSchema.parse(await request.json());
    const [comment, commenter] = await Promise.all([
      prisma.comment.create({
        data: { activityId, userId, body },
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }),
    ]);

    if (mentionedUserIds && mentionedUserIds.length > 0) {
      // Only notify people who can actually see this: approved members of
      // this tracker, and never the commenter mentioning themselves.
      const eligible = await prisma.trackerMembership.findMany({
        where: {
          trackerId: activity.trackerId,
          status: "APPROVED",
          userId: { in: [...new Set(mentionedUserIds)].filter((id) => id !== userId) },
        },
        select: { userId: true },
      });
      if (eligible.length > 0) {
        await createNotifications(
          eligible.map((m) => m.userId),
          "COMMENT_MENTION",
          {
            trackerId: activity.trackerId,
            trackerName: activity.tracker.name,
            activityId: activity.id,
            activityTitle: activity.title,
            mentionedByName: commenter.name,
          }
        );
      }
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
