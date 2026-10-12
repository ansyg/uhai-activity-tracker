import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createGoogleOAuthClient, SIGN_IN_SCOPES, isGoogleSignInConfigured } from "@/lib/auth/google";
import { sanitizeRedirectPath } from "@/lib/http/redirect";

const STATE_COOKIE = "google_oauth_state";
const REDIRECT_COOKIE = "google_oauth_redirect";

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

  // Carries the caller's `?redirect=` across the round trip to Google and
  // back — a query param can't survive that hop since Google only ever
  // returns to our fixed, registered callback URI, so this has to be a
  // cookie (same pattern as the CSRF `state` above). Without it, every
  // Google sign-in — including one started from an invite/reset link — was
  // silently dropping the caller back on /trackers instead of where they
  // meant to end up.
  const redirectPath = sanitizeRedirectPath(request.nextUrl.searchParams.get("redirect"));
  if (redirectPath) {
    store.set(REDIRECT_COOKIE, redirectPath, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
  } else {
    store.delete(REDIRECT_COOKIE);
  }

  const client = createGoogleOAuthClient();
  const url = client.generateAuthUrl({
    access_type: "online",
    scope: SIGN_IN_SCOPES,
    prompt: "select_account",
    state,
  });

  return NextResponse.redirect(url);
}
