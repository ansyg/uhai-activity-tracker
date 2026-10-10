import { google } from "googleapis";

export { isGoogleSignInConfigured } from "./google-config";

/**
 * Used for the "Continue with Google" sign-in flow (ARCHITECTURE.md §5).
 * Calendar connection (§6) requests an *additional* scope via incremental
 * auth on top of this same client/flow, not a separate app registration.
 */
export function createGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  );
}

export const SIGN_IN_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  const client = createGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data } = await oauth2.userinfo.get();

  if (!data.id || !data.email) {
    throw new Error("Google did not return an id/email for this account");
  }

  return {
    googleId: data.id,
    email: data.email,
    name: data.name ?? data.email,
    avatarUrl: data.picture ?? undefined,
  };
}
