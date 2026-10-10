import { NextResponse } from "next/server";
import { getRefreshCookie, rotateSession, SessionReuseError, clearSessionCookies } from "@/lib/auth/session";
import { toPublicUser } from "@/lib/auth/serialize";
import { UnauthorizedError, handleApiError } from "@/lib/api/errors";

export async function POST() {
  try {
    const refreshToken = await getRefreshCookie();
    if (!refreshToken) throw new UnauthorizedError("No active session.");

    try {
      const user = await rotateSession(refreshToken);
      return NextResponse.json({ user: toPublicUser(user) });
    } catch (error) {
      if (error instanceof SessionReuseError) {
        await clearSessionCookies();
        throw new UnauthorizedError("Session expired — sign in again.");
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
