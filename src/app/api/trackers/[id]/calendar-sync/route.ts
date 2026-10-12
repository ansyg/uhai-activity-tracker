import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { syncTrackerActivitiesForAllMembers } from "@/lib/calendar/google-calendar";
import { getAppOrigin } from "@/lib/http/origin";
import { BadRequestError, handleApiError } from "@/lib/api/errors";

/** Owner/Admin-triggered bulk push — see syncTrackerActivitiesForAllMembers for what it actually does. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    const { tracker } = await loadTrackerForViewer(trackerId, userId);
    await requireTrackerGrant(userId, trackerId, "tracker.calendar", "MANAGE");

    if (!tracker.calendarSyncEnabled) {
      throw new BadRequestError(
        'Turn on "Sync activity dates to Google Calendar" in Edit tracker settings before syncing.'
      );
    }

    const result = await syncTrackerActivitiesForAllMembers(trackerId, getAppOrigin(request));
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
