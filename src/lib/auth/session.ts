import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  REFRESH_TOKEN_TTL_SECONDS,
  generateRefreshTokenValue,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from "./tokens";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const isProd = process.env.NODE_ENV === "production";

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
  };
}

async function setSessionCookies(accessToken: string, refreshToken: string) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, { ...baseCookieOptions(), maxAge: 15 * 60 });
  store.set(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

/** Starts a brand new session (login/register): a fresh refresh-token family. */
export async function createSession(userId: string, email: string) {
  const familyId = randomUUID();
  const refreshValue = generateRefreshTokenValue();

  await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: hashRefreshToken(refreshValue),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });

  const accessToken = await signAccessToken({ sub: userId, email });
  await setSessionCookies(accessToken, refreshValue);
}

export class SessionReuseError extends Error {}

/**
 * Rotates the presented refresh token. If it's already been
 * used/revoked, that's a reuse signal (a stolen or replayed token) - the
 * whole family is revoked and the caller must sign in again, per
 * ARCHITECTURE.md §11.
 */
export async function rotateSession(presentedValue: string) {
  const tokenHash = hashRefreshToken(presentedValue);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing) throw new SessionReuseError("Unknown refresh token");

  if (existing.revokedAt || existing.expiresAt < new Date() || !existing.user.isActive) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new SessionReuseError("Refresh token reuse, expiry, or a deactivated account");
  }

  const refreshValue = generateRefreshTokenValue();

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        familyId: existing.familyId,
        tokenHash: hashRefreshToken(refreshValue),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    }),
  ]);

  const accessToken = await signAccessToken({ sub: existing.user.id, email: existing.user.email });
  await setSessionCookies(accessToken, refreshValue);
  return existing.user;
}

export async function revokeSessionByRefreshToken(presentedValue: string) {
  const tokenHash = hashRefreshToken(presentedValue);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (existing) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  await clearSessionCookies();
}

/** Reads the caller's identity from the access-token cookie, if valid. Returns null if not signed in. */
export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = await verifyAccessToken(token);
    return payload.sub;
  } catch {
    return null;
  }
}

export async function getRefreshCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}
