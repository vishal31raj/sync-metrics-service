/**
 * Every source (HubSpot, Google Calendar, Stripe, ...) implements this
 * interface. The pipeline never branches on "which source is this" -- it
 * just calls fetchIncremental/fetchFull and reacts to the typed errors.
 */
export interface FetchResult<T> {
  records: T[];
  /** Opaque cursor to persist for next time. Null if the source is cursor-less. */
  nextCursor: string | null;
  /** True if this source told us there is more to page through right now. */
  hasMore: boolean;
}

export interface SourceAdapter<T> {
  name: string;

  /** Pull everything since `cursor`. Throws StaleCursorError if the cursor is rejected. */
  fetchIncremental(cursor: string | null): Promise<FetchResult<T>>;

  /** Pull the entire dataset, ignoring any cursor. Used for backfill. */
  fetchFull(pageToken?: string | null): Promise<FetchResult<T>>;

  /** Convert one raw record from this source into the normalized shape for upsert. */
  normalize(record: T): NormalizedRecord;
}

export type NormalizedEntityType = "contact" | "calendar_event" | "transaction";

export interface NormalizedRecord {
  entityType: NormalizedEntityType;
  source: string;
  sourceId: string;
  data: Record<string, unknown>;
}

/**
 * Thrown by a source adapter when the incremental cursor it was given is no
 * longer valid -- e.g. HubSpot returns 410 Gone on an expired
 * `since` token, or a webhook subscription token expired. The pipeline
 * catches this specifically and falls back to a full backfill instead of
 * treating it like a generic failure.
 */
export class StaleCursorError extends Error {
  constructor(public readonly source: string, public readonly cause?: unknown) {
    super(`Cursor rejected by source "${source}" (stale/expired) -- falling back to full backfill`);
    this.name = "StaleCursorError";
  }
}

/** Thrown for any other source-side failure (network, auth, 5xx, garbage payload). */
export class SourceUnavailableError extends Error {
  constructor(public readonly source: string, public readonly cause?: unknown) {
    super(`Source "${source}" is unavailable or returned an unexpected response`);
    this.name = "SourceUnavailableError";
  }
}
