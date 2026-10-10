import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 min, per ARCHITECTURE.md §5
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface AccessTokenPayload extends JWTPayload {
  sub: string; // User.id
  email: string;
}

function secret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): Uint8Array {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return new TextEncoder().encode(value);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret("JWT_ACCESS_SECRET"));
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secret("JWT_ACCESS_SECRET"));
  return payload as unknown as AccessTokenPayload;
}

/** Opaque refresh token: a random value the client holds; only its hash is ever stored. */
export function generateRefreshTokenValue(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
