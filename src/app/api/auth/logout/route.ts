import { NextResponse } from "next/server";
import { getRefreshCookie, revokeSessionByRefreshToken, clearSessionCookies } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";

export async function POST() {
  try {
    const refreshToken = await getRefreshCookie();
    if (refreshToken) {
      await revokeSessionByRefreshToken(refreshToken);
    } else {
      await clearSessionCookies();
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
