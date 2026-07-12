import fs from "fs";
import { SourceUnavailableError } from "./types";

export async function getGoogleAccessToken(): Promise<string> {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new SourceUnavailableError(
      "google_calendar",
      "missing GOOGLE_SERVICE_ACCOUNT_JSON",
    );
  }

  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token)
    throw new SourceUnavailableError(
      "google_calendar",
      "token exchange failed",
    );
  return token.token;
}
