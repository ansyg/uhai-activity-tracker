import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications/create";
import { UnauthorizedError, handleApiError } from "@/lib/api/errors";

const DUE_SOON_WINDOW_DAYS = 2;

interface ActivityForReminder {
  id: string;
  title: string;
  trackerId: string;
  tracker: { name: string };
  assignees: { userId: string | null }[];
}

/**
 * Daily sweep for DEADLINE_DUE_SOON / DEADLINE_OVERDUE — both notification
 * types have existed in the schema since the start but nothing ever created
 * one (no job runner exists in this deployment). Triggered by Vercel Cron
 * (see vercel.json), guarded by CRON_SECRET since this route has no user
 * session to check. Dedupes by "has this exact user+activity+type already
 * been notified, ever" rather than a time window, so re-running the cron
 * (or a slow day) never double-sends.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      throw new UnauthorizedError("Missing or invalid cron secret.");
    }

    const now = new Date();
    const dueSoonBy = new Date(now.getTime() + DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const selectForReminder = {
      id: true,
      title: true,
      trackerId: true,
      tracker: { select: { name: true } },
      assignees: { select: { userId: true } },
    } as const;

    const [dueSoonActivities, overdueActivities] = await Promise.all([
      prisma.activity.findMany({
        where: { status: { not: "COMPLETED" }, endDate: { gte: now, lte: dueSoonBy } },
        select: selectForReminder,
      }),
      prisma.activity.findMany({
        where: { status: { not: "COMPLETED" }, endDate: { lt: now } },
        select: selectForReminder,
      }),
    ]);

    async function notifyOnce(
      activity: ActivityForReminder,
      type: "DEADLINE_DUE_SOON" | "DEADLINE_OVERDUE"
    ): Promise<number> {
      const userIds = [...new Set(activity.assignees.map((a) => a.userId).filter((id): id is string => !!id))];
      let sent = 0;
      for (const userId of userIds) {
        const already = await prisma.notification.findFirst({
          where: { userId, type, payload: { path: ["activityId"], equals: activity.id } },
        });
        if (already) continue;
        await createNotification(userId, type, {
          trackerId: activity.trackerId,
          trackerName: activity.tracker.name,
          activityId: activity.id,
          activityTitle: activity.title,
        });
        sent++;
      }
      return sent;
    }

    const dueSoonCounts = await Promise.all(dueSoonActivities.map((a) => notifyOnce(a, "DEADLINE_DUE_SOON")));
    const overdueCounts = await Promise.all(overdueActivities.map((a) => notifyOnce(a, "DEADLINE_OVERDUE")));

    return NextResponse.json({
      dueSoonActivities: dueSoonActivities.length,
      dueSoonNotificationsSent: dueSoonCounts.reduce((a, b) => a + b, 0),
      overdueActivities: overdueActivities.length,
      overdueNotificationsSent: overdueCounts.reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
