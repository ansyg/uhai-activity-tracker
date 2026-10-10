import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/api/guard";
import { getGlobalGrants, getTrackerGrants } from "@/lib/rbac/permissions";
import { handleApiError } from "@/lib/api/errors";

/**
 * The caller's resolved menu/action grants, used by the UI to decide what
 * nav items and buttons to show (ARCHITECTURE.md §5 — the client never
 * decides access, it only hides what these grants don't cover; the server
 * re-checks every route independently).
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const trackerId = request.nextUrl.searchParams.get("trackerId");

    const global = await getGlobalGrants(userId);
    const tracker = trackerId ? await getTrackerGrants(userId, trackerId) : null;

    return NextResponse.json({
      global: Array.from(global),
      tracker: tracker ? Array.from(tracker) : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
