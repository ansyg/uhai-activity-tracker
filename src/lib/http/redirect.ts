/**
 * A same-origin relative path safe to redirect to after an external round
 * trip (Google OAuth, etc.) — used wherever a caller-supplied `?redirect=`
 * has to survive a hop to a third party and back via a cookie, since it
 * can't ride along as a query param.
 *
 * Rejects anything that could resolve to a different origin once parsed as
 * a URL: a second leading slash or backslash (`//evil.com`, `/\evil.com`)
 * is treated as protocol-relative by WHATWG URL parsing for special
 * schemes (http/https/...) — browsers and Node's URL both normalize a
 * leading backslash to a slash before resolving, so `/\evil.com` quietly
 * becomes `//evil.com`, an open redirect, even though the raw string
 * passes a naive `startsWith("/")` check. Also rejects an embedded
 * `://` and any backslash/control character anywhere in the value, not
 * just at the start.
 */
export function sanitizeRedirectPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^\/[^/\\]/.test(value)) return null; // exactly one leading '/', next char not '/' or '\'
  if (/[\\\t\r\n]/.test(value)) return null; // no backslash or control chars anywhere in the value
  if (value.includes("://")) return null;
  return value;
}
