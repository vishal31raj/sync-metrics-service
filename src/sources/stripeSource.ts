import fetch from "node-fetch";
import { z } from "zod";
import {
  SourceAdapter,
  FetchResult,
  NormalizedRecord,
  StaleCursorError,
  SourceUnavailableError,
} from "./types";
import { mapStatus } from "../normalize/statusMap";

const STRIPE_BASE = process.env.STRIPE_BASE_URL || "https://api.stripe.com";
const SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

const StripeChargeSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.string(), // 'succeeded' | 'pending' | 'failed', plus refunded flag below
  refunded: z.boolean().optional(),
  created: z.number(), // unix seconds
});
export type StripeCharge = z.infer<typeof StripeChargeSchema>;

interface StripeListResponse {
  data: unknown[];
  has_more: boolean;
}

async function stripeRequest(path: string) {
  const res = await fetch(`${STRIPE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${SECRET_KEY}` },
  });

  if (res.status === 410) {
    throw new StaleCursorError("stripe", { status: 410 });
  }
  if (!res.ok) {
    // Stripe doesn't literally 410 on a bad `starting_after` cursor -- it
    // 400s with code=resource_missing. We treat that specific case as a
    // stale cursor too (the pointer refers to an object that no longer
    // exists in the paging window), everything else as a hard failure.
    const text = await res.text();
    if (res.status === 400 && text.includes("resource_missing")) {
      throw new StaleCursorError("stripe", { status: 400, body: text });
    }
    throw new SourceUnavailableError("stripe", { status: res.status, body: text });
  }
  return res.json();
}

export const stripeSource: SourceAdapter<StripeCharge> = {
  name: "stripe",

  async fetchIncremental(cursor: string | null): Promise<FetchResult<StripeCharge>> {
    if (!cursor) throw new StaleCursorError("stripe", "no cursor on file");

    // Cursor format: `${unixTimestamp}` (created >= cursor) OR a Stripe
    // object id for cursor-based pagination -- we use created timestamps
    // here since Stripe's list API supports `created[gte]`.
    let body: StripeListResponse;
    try {
      body = (await stripeRequest(
        `/v1/charges?created[gte]=${encodeURIComponent(cursor)}&limit=100`
      )) as StripeListResponse;
    } catch (err) {
      if (err instanceof StaleCursorError) throw err;
      throw new SourceUnavailableError("stripe", err);
    }

    const valid = parseAndFilter(body.data);
    const newest = valid.map((c) => c.created).sort((a, b) => a - b).pop();

    return {
      records: valid,
      nextCursor: newest ? String(newest) : cursor,
      hasMore: body.has_more,
    };
  },

  async fetchFull(pageToken?: string | null): Promise<FetchResult<StripeCharge>> {
    const qs = new URLSearchParams({ limit: "100" });
    if (pageToken) qs.set("starting_after", pageToken);

    let body: StripeListResponse;
    try {
      body = (await stripeRequest(`/v1/charges?${qs.toString()}`)) as StripeListResponse;
    } catch (err) {
      if (err instanceof StaleCursorError) throw err;
      throw new SourceUnavailableError("stripe", err);
    }

    const valid = parseAndFilter(body.data);
    const lastId = valid.length ? valid[valid.length - 1].id : pageToken ?? null;
    const newestCreated = valid.map((c) => c.created).sort((a, b) => a - b).pop();

    return {
      records: valid,
      nextCursor: body.has_more ? lastId : newestCreated ? String(newestCreated) : null,
      hasMore: body.has_more,
    };
  },

  normalize(record: StripeCharge): NormalizedRecord {
    // "refunded: true" overrides "status: succeeded" -- Stripe keeps both
    // flags set simultaneously on a refunded charge, so the raw status
    // string alone ('succeeded') would misclassify it as collected revenue.
    const rawStatus = record.refunded ? "refunded" : record.status;
    return {
      entityType: "transaction",
      source: "stripe",
      sourceId: record.id,
      data: {
        amountCents: record.amount,
        currency: record.currency,
        rawStatus,
        canonicalStatus: mapStatus("stripe", rawStatus),
        occurredAt: new Date(record.created * 1000),
        sourceUpdatedAt: new Date(record.created * 1000),
        raw: record,
      },
    };
  },
};

function parseAndFilter(items: unknown[]): StripeCharge[] {
  const out: StripeCharge[] = [];
  for (const item of items || []) {
    const parsed = StripeChargeSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
