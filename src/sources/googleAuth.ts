import fs from "fs";
import { SourceUnavailableError } from "./types";

/**
 * Exchanges the Google service-account JSON for a bearer token. Uses the
 * standard JWT-bearer OAuth flow. Isolated in its own module so the
 * calendar adapter's fetch/cursor logic can be unit-tested without a real
 * Google credential.
 */
export async function getGoogleAccessToken(): Promise<string> {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new SourceUnavailableError("google_calendar", "missing GOOGLE_SERVICE_ACCOUNT_JSON");
  }
  // Deliberately minimal: swap in `google-auth-library`'s GoogleAuth if you
  // want automatic token caching/refresh in production.
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new SourceUnavailableError("google_calendar", "token exchange failed");
  return token.token;
}
