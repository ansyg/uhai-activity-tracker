import type { NextRequest } from "next/server";

/**
 * The canonical origin for links that go out in emails (password reset,
 * invites) — never trust the inbound Host header for this. An attacker can
 * spoof it on a direct API request (independent of what's in a browser's
 * address bar) to poison a reset/invite link sent to a victim's inbox, then
 * steal the token when they click it. Set APP_URL in production; falls back
 * to the request's own origin only for local dev, where there's no
 * untrusted network path to the server.
 */
export function getAppOrigin(request: NextRequest): string {
  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    console.warn("APP_URL is not set — falling back to the request's Host header for email links. Set APP_URL to close this.");
  }
  return request.nextUrl.origin;
}
