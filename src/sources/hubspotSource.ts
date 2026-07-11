import fetch from "node-fetch";
import { z } from "zod";
import {
  SourceAdapter,
  FetchResult,
  NormalizedRecord,
  StaleCursorError,
  SourceUnavailableError,
} from "./types";

const HUBSPOT_BASE = process.env.HUBSPOT_BASE_URL || "https://api.hubapi.com";
const API_KEY = process.env.HUBSPOT_API_KEY || "";

// Loose validation: we only require the fields we actually depend on.
// Anything else in the payload is preserved as-is in `raw` for audit, but a
// record missing these required fields is "garbage" and gets skipped
// (per-record, not per-batch -- see pipeline).
const HubSpotContactSchema = z.object({
  id: z.string(),
  properties: z.object({
    email: z.string().nullable().optional(),
    firstname: z.string().nullable().optional(),
    lastname: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    lifecyclestage: z.string().nullable().optional(),
    hs_lastmodifieddate: z.string().nullable().optional(),
  }),
});
export type HubSpotContact = z.infer<typeof HubSpotContactSchema>;

interface HubSpotSearchResponse {
  results: unknown[];
  paging?: { next?: { after: string } };
}

async function hubspotRequest(path: string, opts: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    method: opts.method || "GET",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 410 || res.status === 401) {
    // 410 Gone: paging/cursor token expired. 401 here (after a prior
    // successful auth) usually means a rotated token tied to a stale
    // subscription -- we treat both as "the cursor we hold is no longer
    // trustworthy" rather than a hard outage.
    throw new StaleCursorError("hubspot", { status: res.status });
  }
  if (!res.ok) {
    throw new SourceUnavailableError("hubspot", { status: res.status, body: await res.text() });
  }
  return res.json();
}

export const hubspotSource: SourceAdapter<HubSpotContact> = {
  name: "hubspot",

  async fetchIncremental(cursor: string | null): Promise<FetchResult<HubSpotContact>> {
    // HubSpot's CRM search API takes a `lastmodifieddate >= cursor` filter
    // for incremental pulls. We treat `cursor` as an ISO timestamp string.
    if (!cursor) {
      // No cursor yet ever recorded -> this source has never synced. Let the
      // pipeline decide to do a full backfill instead of guessing a window.
      throw new StaleCursorError("hubspot", "no cursor on file");
    }

    let body: HubSpotSearchResponse;
    try {
      body = (await hubspotRequest("/crm/v3/objects/contacts/search", {
        method: "POST",
        body: {
          filterGroups: [
            { filters: [{ propertyName: "hs_lastmodifieddate", operator: "GTE", value: cursor }] },
          ],
          properties: ["email", "firstname", "lastname", "company", "lifecyclestage", "hs_lastmodifieddate"],
          limit: 100,
        },
      })) as HubSpotSearchResponse;
    } catch (err) {
      if (err instanceof StaleCursorError) throw err;
      throw new SourceUnavailableError("hubspot", err);
    }

    const validRecords = parseAndFilter(body.results);
    const newest = validRecords
      .map((r) => r.properties.hs_lastmodifieddate)
      .filter((d): d is string => !!d)
      .sort()
      .pop();

    return {
      records: validRecords,
      nextCursor: newest || cursor,
      hasMore: !!body.paging?.next,
    };
  },

  async fetchFull(pageToken?: string | null): Promise<FetchResult<HubSpotContact>> {
    const qs = new URLSearchParams({
      limit: "100",
      properties: "email,firstname,lastname,company,lifecyclestage,hs_lastmodifieddate",
    });
    if (pageToken) qs.set("after", pageToken);

    let body: HubSpotSearchResponse;
    try {
      body = (await hubspotRequest(`/crm/v3/objects/contacts?${qs.toString()}`)) as HubSpotSearchResponse;
    } catch (err) {
      if (err instanceof StaleCursorError) throw err; // shouldn't happen on full fetch, but stay consistent
      throw new SourceUnavailableError("hubspot", err);
    }

    const validRecords = parseAndFilter(body.results);
    const newest = validRecords
      .map((r) => r.properties.hs_lastmodifieddate)
      .filter((d): d is string => !!d)
      .sort()
      .pop();

    return {
      records: validRecords,
      nextCursor: body.paging?.next?.after ?? newest ?? null,
      hasMore: !!body.paging?.next,
    };
  },

  normalize(record: HubSpotContact): NormalizedRecord {
    const p = record.properties;
    const name = [p.firstname, p.lastname].filter(Boolean).join(" ") || null;
    return {
      entityType: "contact",
      source: "hubspot",
      sourceId: record.id,
      data: {
        email: p.email ?? null,
        fullName: name,
        company: p.company ?? null,
        lifecycleStage: p.lifecyclestage ?? null,
        sourceUpdatedAt: p.hs_lastmodifieddate ? new Date(p.hs_lastmodifieddate) : null,
        raw: record,
      },
    };
  },
};

/** Validates each raw item; drops (and counts, via caller) anything malformed
 *  instead of throwing and losing the whole batch. */
function parseAndFilter(results: unknown[]): HubSpotContact[] {
  const out: HubSpotContact[] = [];
  for (const r of results) {
    const parsed = HubSpotContactSchema.safeParse(r);
    if (parsed.success) out.push(parsed.data);
    // Invalid records are silently skipped here; the pipeline's per-record
    // try/catch around normalize+upsert is what actually logs the count of
    // skipped/garbage records to sync_runs.records_failed.
  }
  return out;
}
