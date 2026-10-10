import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeCodeForProfile } from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";

const STATE_COOKIE = "google_oauth_state";

function redirectToSignIn(request: NextRequest, errorMessage: string) {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("error", errorMessage);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const store = await cookies();
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
