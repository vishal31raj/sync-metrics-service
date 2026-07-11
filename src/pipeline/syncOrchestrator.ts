import { SyncCursor, SyncRun } from "../models";
import { upsertNormalizedRecord } from "./upsert";
import {
  SourceAdapter,
  StaleCursorError,
  SourceUnavailableError,
  FetchResult,
} from "../sources/types";

export interface SourceSyncSummary {
  source: string;
  mode: "incremental" | "full_backfill";
  status: "success" | "partial" | "failed";
  recordsSeen: number;
  recordsWritten: number;
  recordsFailed: number;
  errorMessage?: string;
}

const MAX_BACKFILL_PAGES = 500; // safety valve against a runaway full sync

/**
 * Runs one source end-to-end: try incremental off the stored cursor; if the
 * cursor is stale/rejected, transparently fall back to a full backfill
 * instead of losing data or throwing. Writes are upserts, so replaying a
 * full backfill after an incremental partially landed is always safe --
 * every record just gets re-written to the same row.
 *
 * This function NEVER throws. Any failure is captured into the returned
 * summary so the caller (runFullSync) can let the other sources keep going.
 */
export async function runSourceSync<T>(adapter: SourceAdapter<T>): Promise<SourceSyncSummary> {
  const startedAt = new Date();
  let mode: "incremental" | "full_backfill" = "incremental";
  let recordsSeen = 0;
  let recordsWritten = 0;
  let recordsFailed = 0;

  try {
    const existingCursor = await SyncCursor.findByPk(adapter.name);
    const cursorValue = existingCursor?.cursorValue ?? null;

    let result: FetchResult<T>;
    try {
      result = await adapter.fetchIncremental(cursorValue);
    } catch (err) {
      if (err instanceof StaleCursorError) {
        // Cursor rejected (410 / expired token / never synced before).
        // Fall back to a full backfill rather than crashing or skipping.
        mode = "full_backfill";
        const backfill = await runFullBackfill(adapter);
        recordsSeen += backfill.recordsSeen;
        recordsWritten += backfill.recordsWritten;
        recordsFailed += backfill.recordsFailed;
        await persistCursor(adapter.name, backfill.finalCursor);
        return finalizeSummary(adapter.name, mode, recordsSeen, recordsWritten, recordsFailed, startedAt);
      }
      throw err; // SourceUnavailableError or anything unexpected -> outer catch
    }

    recordsSeen += result.records.length;
    const written = await writeAll(adapter, result.records);
    recordsWritten += written.written;
    recordsFailed += written.failed;

    // Page through any remaining incremental results the same way.
    let cursor = result.nextCursor;
    let hasMore = result.hasMore;
    let pages = 0;
    while (hasMore && pages < MAX_BACKFILL_PAGES) {
      pages++;
      const next = await adapter.fetchIncremental(cursor);
      recordsSeen += next.records.length;
      const w = await writeAll(adapter, next.records);
      recordsWritten += w.written;
      recordsFailed += w.failed;
      cursor = next.nextCursor;
      hasMore = next.hasMore;
    }

    await persistCursor(adapter.name, cursor);
    return finalizeSummary(adapter.name, mode, recordsSeen, recordsWritten, recordsFailed, startedAt);
  } catch (err) {
    // SourceUnavailableError (down, auth failure, garbage response we
    // couldn't even page through) or any unexpected exception lands here.
    // We log it and return a "failed" summary -- we do NOT rethrow, so a
    // dead source never takes down the other two.
    const message = err instanceof Error ? err.message : String(err);
    await SyncRun.create({
      source: adapter.name,
      mode,
      status: "failed",
      recordsSeen,
      recordsWritten,
      recordsFailed,
      errorMessage: message,
      startedAt,
      finishedAt: new Date(),
    });
    return {
      source: adapter.name,
      mode,
      status: "failed",
      recordsSeen,
      recordsWritten,
      recordsFailed,
      errorMessage: message,
    };
  }
}

async function runFullBackfill<T>(
  adapter: SourceAdapter<T>
): Promise<{ recordsSeen: number; recordsWritten: number; recordsFailed: number; finalCursor: string | null }> {
  let recordsSeen = 0;
  let recordsWritten = 0;
  let recordsFailed = 0;
  let pageToken: string | null = null;
  let finalCursor: string | null = null;
  let pages = 0;
  let hasMore = true;

  while (hasMore && pages < MAX_BACKFILL_PAGES) {
    pages++;
    const page = await adapter.fetchFull(pageToken);
    recordsSeen += page.records.length;
    const w = await writeAll(adapter, page.records);
    recordsWritten += w.written;
    recordsFailed += w.failed;
    hasMore = page.hasMore;
    pageToken = page.nextCursor;
    finalCursor = page.nextCursor ?? finalCursor;
  }

  return { recordsSeen, recordsWritten, recordsFailed, finalCursor };
}

/**
 * Writes each record independently. A malformed record or a single failed
 * upsert doesn't abort the batch -- it's counted as failed and the loop
 * continues, so one bad row can't wedge an entire source's sync.
 */
async function writeAll<T>(adapter: SourceAdapter<T>, records: T[]): Promise<{ written: number; failed: number }> {
  let written = 0;
  let failed = 0;
  for (const record of records) {
    try {
      const normalized = adapter.normalize(record);
      await upsertNormalizedRecord(normalized);
      written++;
    } catch (err) {
      failed++;
      // eslint-disable-next-line no-console
      console.error(`[sync:${adapter.name}] failed to write record, skipping`, err);
    }
  }
  return { written, failed };
}

async function persistCursor(source: string, cursorValue: string | null): Promise<void> {
  await SyncCursor.upsert({ source, cursorValue });
}

async function finalizeSummary(
  source: string,
  mode: "incremental" | "full_backfill",
  recordsSeen: number,
  recordsWritten: number,
  recordsFailed: number,
  startedAt: Date
): Promise<SourceSyncSummary> {
  const status: SourceSyncSummary["status"] = recordsFailed === 0 ? "success" : "partial";
  await SyncRun.create({
    source,
    mode,
    status,
    recordsSeen,
    recordsWritten,
    recordsFailed,
    startedAt,
    finishedAt: new Date(),
  });
  return { source, mode, status, recordsSeen, recordsWritten, recordsFailed };
}

/**
 * Runs all given sources concurrently and independently. Uses
 * Promise.allSettled (never Promise.all) so that one source throwing
 * synchronously can't prevent the others' results from being collected --
 * though in practice runSourceSync() already swallows its own errors, this
 * is defense in depth against a genuinely unexpected bug in one adapter.
 */
export async function runFullSync(adapters: SourceAdapter<unknown>[]): Promise<SourceSyncSummary[]> {
  const settled = await Promise.allSettled(adapters.map((a) => runSourceSync(a)));
  return settled.map((result, i) =>
    result.status === "fulfilled"
      ? result.value
      : {
          source: adapters[i].name,
          mode: "incremental" as const,
          status: "failed" as const,
          recordsSeen: 0,
          recordsWritten: 0,
          recordsFailed: 0,
          errorMessage: String(result.reason),
        }
  );
}
