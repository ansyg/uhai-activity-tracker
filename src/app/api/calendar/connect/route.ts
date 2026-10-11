import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getCurrentUserId } from "@/lib/auth/session";
import { isGoogleSignInConfigured } from "@/lib/auth/google-config";
import { CALENDAR_SCOPES } from "@/lib/calendar/google-calendar";
import { CALENDAR_STATE_COOKIE } from "@/lib/calendar/constants";

/**
 * Starts the Calendar-connect consent flow. Reuses the same registered
 * OAuth redirect URI as sign-in (Google only allows exchanging a code at a
 * URI that's actually registered for this client) — the shared callback at
 * /api/auth/google/callback tells the two flows apart by which state
 * cookie matches.
 */
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("redirect", "/account");
    return NextResponse.redirect(url);
  }

  if (!isGoogleSignInConfigured()) {
    const url = new URL("/account", request.url);
    url.searchParams.set("calendarError", "Google isn't configured on this deployment yet.");
    return NextResponse.redirect(url);
  }

  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(CALENDAR_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  );
  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: CALENDAR_SCOPES,
    prompt: "consent", // force a refresh_token every time, including on reconnect
    state,
  });

  return NextResponse.redirect(url);
}
