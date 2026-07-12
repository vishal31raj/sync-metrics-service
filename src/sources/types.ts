export interface FetchResult<T> {
  records: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SourceAdapter<T> {
  name: string;
  fetchIncremental(cursor: string | null): Promise<FetchResult<T>>;
  fetchFull(pageToken?: string | null): Promise<FetchResult<T>>;
  normalize(record: T): NormalizedRecord;
}

export type NormalizedEntityType = "contact" | "calendar_event" | "transaction";

export interface NormalizedRecord {
  entityType: NormalizedEntityType;
  source: string;
  sourceId: string;
  data: Record<string, unknown>;
}

export class StaleCursorError extends Error {
  constructor(
    public readonly source: string,
    public readonly cause?: unknown,
  ) {
    super(
      `Cursor rejected by source "${source}" (stale/expired) -- falling back to full backfill`,
    );
    this.name = "StaleCursorError";
  }
}
export class SourceUnavailableError extends Error {
  constructor(
    public readonly source: string,
    public readonly cause?: unknown,
  ) {
    super(
      `Source "${source}" is unavailable or returned an unexpected response`,
    );
    this.name = "SourceUnavailableError";
  }
}
