import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeCodeForProfile } from "@/lib/auth/google";
import { createSession, getCurrentUserId } from "@/lib/auth/session";
import { exchangeCodeForCalendarTokens } from "@/lib/calendar/google-calendar";
import { encrypt } from "@/lib/calendar/crypto";
import { CALENDAR_STATE_COOKIE } from "@/lib/calendar/constants";

const STATE_COOKIE = "google_oauth_state";

function redirectToSignIn(request: NextRequest, errorMessage: string) {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("error", errorMessage);
  return NextResponse.redirect(url);
}

function redirectToAccount(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/account", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

/** Completes the Calendar-connect consent flow (see /api/calendar/connect) — a signed-in user re-consenting with an added scope, not a sign-in. */
async function handleCalendarConnectCallback(request: NextRequest, code: string | null) {
  const userId = await getCurrentUserId();
  if (!userId) return redirectToSignIn(request, "Sign in, then connect Google Calendar from your account page.");
  if (!code) return redirectToAccount(request, { calendarError: "Google Calendar connection failed — please try again." });

  try {
    const tokens = await exchangeCodeForCalendarTokens(code);
    await prisma.calendarConnection.upsert({
      where: { userId },
      update: {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        scope: tokens.scope,
        expiry: tokens.expiry,
      },
      create: {
        userId,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        scope: tokens.scope,
        expiry: tokens.expiry,
        calendarId: "primary",
      },
    });
    return redirectToAccount(request, { calendarConnected: "1" });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Google Calendar connection failed — please try again.";
    return redirectToAccount(request, { calendarError: message });
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const store = await cookies();

  const calendarState = store.get(CALENDAR_STATE_COOKIE)?.value;
  if (calendarState) {
    store.delete(CALENDAR_STATE_COOKIE);
    if (state !== calendarState) {
      return redirectToAccount(request, { calendarError: "Google Calendar connection failed — please try again." });
    }
    return handleCalendarConnectCallback(request, code);
  }

  const expectedState = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToSignIn(request, "Google sign-in failed — please try again.");
  }

  try {
    const profile = await exchangeCodeForProfile(code);
    const email = profile.email.toLowerCase();

    // Link by googleId first (returning Google user), then fall back to
    // matching an existing email+password account — same identity, now
    // with Google linked too, per ARCHITECTURE.md §5's "incremental auth,
    // not a second account".
    let user = await prisma.user.findUnique({ where: { googleId: profile.googleId } });
    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId: profile.googleId, avatarUrl: profile.avatarUrl ?? byEmail.avatarUrl },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email,
            name: profile.name,
            googleId: profile.googleId,
            avatarUrl: profile.avatarUrl,
          },
        });
      }
    }

    if (!user.isActive) {
      return redirectToSignIn(request, "This account has been deactivated. Contact your tracker owner for access.");
    }

    await createSession(user.id, user.email);
    return NextResponse.redirect(new URL("/trackers", request.url));
  } catch (error) {
    console.error(error);
    return redirectToSignIn(request, "Google sign-in failed — please try again.");
  }
}
