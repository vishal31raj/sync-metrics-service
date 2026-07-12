import fetch from "node-fetch";
import { z } from "zod";
import {
  SourceAdapter,
  FetchResult,
  NormalizedRecord,
  StaleCursorError,
  SourceUnavailableError,
} from "./types";

const CALENDAR_ID = encodeURIComponent(
  process.env.GOOGLE_CALENDAR_ID || "primary",
);
const BASE = "https://www.googleapis.com/calendar/v3";

const GCalEventSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  summary: z.string().optional(),
  start: z
    .object({ dateTime: z.string().optional(), date: z.string().optional() })
    .optional(),
  end: z
    .object({ dateTime: z.string().optional(), date: z.string().optional() })
    .optional(),
  attendees: z.array(z.object({ email: z.string().optional() })).optional(),
  updated: z.string().optional(),
});
export type GCalEvent = z.infer<typeof GCalEventSchema>;

async function getAccessToken(): Promise<string> {
  const mod = await import("./googleAuth");
  return mod.getGoogleAccessToken();
}

async function gcalRequest(path: string) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 410) {
    throw new StaleCursorError("google_calendar", { status: 410 });
  }
  if (!res.ok) {
    const body = await res.text();

    throw new SourceUnavailableError("google_calendar", {
      status: res.status,
      body,
    });
  }
  return res.json();
}

interface GCalListResponse {
  items: unknown[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export const googleCalendarSource: SourceAdapter<GCalEvent> = {
  name: "google_calendar",

  async fetchIncremental(
    cursor: string | null,
  ): Promise<FetchResult<GCalEvent>> {
    if (!cursor)
      throw new StaleCursorError("google_calendar", "no syncToken on file");

    let body: GCalListResponse;
    try {
      body = (await gcalRequest(
        `/calendars/${CALENDAR_ID}/events?syncToken=${encodeURIComponent(cursor)}`,
      )) as GCalListResponse;
    } catch (err) {
      if (err instanceof StaleCursorError) throw err;
      throw new SourceUnavailableError("google_calendar", err);
    }

    const valid = parseAndFilter(body.items);
    return {
      records: valid,
      nextCursor: body.nextSyncToken ?? cursor,
      hasMore: !!body.nextPageToken,
    };
  },

  async fetchFull(pageToken?: string | null): Promise<FetchResult<GCalEvent>> {
    const qs = new URLSearchParams({
      singleEvents: "true",
      showDeleted: "true",
      maxResults: "250",
    });
    if (pageToken) qs.set("pageToken", pageToken);

    let body: GCalListResponse;
    try {
      body = (await gcalRequest(
        `/calendars/${CALENDAR_ID}/events?${qs.toString()}`,
      )) as GCalListResponse;
    } catch (err) {
      if (err instanceof StaleCursorError) throw err;
      throw new SourceUnavailableError("google_calendar", err);
    }

    const valid = parseAndFilter(body.items);
    return {
      records: valid,

      nextCursor: body.nextSyncToken ?? pageToken ?? null,
      hasMore: !!body.nextPageToken,
    };
  },

  normalize(record: GCalEvent): NormalizedRecord {
    return {
      entityType: "calendar_event",
      source: "google_calendar",
      sourceId: record.id,
      data: {
        title: record.summary ?? null,
        startsAt: record.start?.dateTime ?? record.start?.date ?? null,
        endsAt: record.end?.dateTime ?? record.end?.date ?? null,
        attendeeEmails: (record.attendees || [])
          .map((a) => a.email)
          .filter(Boolean),
        status: record.status ?? null,
        sourceUpdatedAt: record.updated ? new Date(record.updated) : null,
        raw: record,
      },
    };
  },
};

function parseAndFilter(items: unknown[]): GCalEvent[] {
  const out: GCalEvent[] = [];
  for (const item of items || []) {
    const parsed = GCalEventSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
