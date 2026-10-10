import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/api/guard";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { computeTrackerDashboard } from "@/lib/trackers/dashboard";
import { handleApiError } from "@/lib/api/errors";

/**
 * The tracker summary tiles + per-phase breakdown from ARCHITECTURE.md §8.
 * Timeline/workload/trend/by-module views are delivery-order item 7 and
 * aren't built yet — this covers the "Tracker summary" view only.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    await loadTrackerForViewer(trackerId, userId);

    const dashboard = await computeTrackerDashboard(trackerId);
    return NextResponse.json(dashboard);
  } catch (error) {
    return handleApiError(error);
  }
}
