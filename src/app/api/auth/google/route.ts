import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createGoogleOAuthClient, SIGN_IN_SCOPES, isGoogleSignInConfigured } from "@/lib/auth/google";

const STATE_COOKIE = "google_oauth_state";

/** Redirects to Google's consent screen to sign in (not to connect Calendar — that's a separate, later flow). */
export async function GET(request: NextRequest) {
  if (!isGoogleSignInConfigured()) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("error", "Google sign-in isn't set up yet — use email and password instead.");
    return NextResponse.redirect(url);
  }

  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  const client = createGoogleOAuthClient();
  const url = client.generateAuthUrl({
    access_type: "online",
    scope: SIGN_IN_SCOPES,
    prompt: "select_account",
    state,
  });

  return NextResponse.redirect(url);
}
