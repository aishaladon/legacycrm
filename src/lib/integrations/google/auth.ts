import "server-only";

import { google } from "googleapis";

/**
 * OAuth2 client for Aisha's own Google account (Gmail, Calendar, Drive).
 * Requires a Google Cloud OAuth "Desktop app" client with the Gmail,
 * Calendar, and Drive (readonly) APIs enabled, and a refresh token minted
 * once via the consent screen — see scripts/google-oauth-setup.md.
 */
export function getGoogleAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN must be set to use Google integrations.",
    );
  }

  const client = new google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
