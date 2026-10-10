/**
 * Deliberately has no import of `googleapis` — unlike google.ts, so pages that
 * only need to know whether Google sign-in is available don't drag that whole
 * module graph (and its Node-only deps) into their bundle.
 */
export function isGoogleSignInConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
