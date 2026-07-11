/**
 * Integration test -- requires a real Postgres database, see
 * metrics.consistency.test.ts header for setup. Uses hand-written fake
 * SourceAdapters so the test doesn't depend on live HubSpot/Stripe/Google
 * credentials -- it's testing the orchestrator's control flow, not the
 * real HTTP adapters (those are exercised by pointing REAL_* env vars at
 * sandbox accounts and running `npm run sync` manually / in CI nightly).
 */
import { sequelize, SyncCursor, SyncRun, Transaction } from "../src/models";
import { runSourceSync, runFullSync } from "../src/pipeline/syncOrchestrator";
import { SourceAdapter, StaleCursorError, SourceUnavailableError, NormalizedRecord } from "../src/sources/types";

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await SyncCursor.destroy({ where: {}, truncate: true, cascade: true });
  await SyncRun.destroy({ where: {}, truncate: true, cascade: true });
  await Transaction.destroy({ where: {}, truncate: true, cascade: true });
});

type FakeTxn = { id: string; amount: number };

function fakeSource(name: string): SourceAdapter<FakeTxn> {
  return {
    name,
    async fetchIncremental(cursor) {
      if (!cursor) throw new StaleCursorError(name, "no cursor");
      return { records: [{ id: `${name}-inc-1`, amount: 100 }], nextCursor: "cursor-2", hasMore: false };
    },
    async fetchFull() {
      return {
        records: [
          { id: `${name}-full-1`, amount: 100 },
          { id: `${name}-full-2`, amount: 200 },
        ],
        nextCursor: "cursor-from-backfill",
        hasMore: false,
      };
    },
    normalize(record): NormalizedRecord {
      return {
        entityType: "transaction",
        source: name,
        sourceId: record.id,
        data: {
          amountCents: record.amount,
          currency: "usd",
          rawStatus: "succeeded",
          canonicalStatus: "collected",
          occurredAt: new Date(),
          sourceUpdatedAt: new Date(),
          raw: record,
        },
      };
    },
  };
}

function alwaysDownSource(name: string): SourceAdapter<FakeTxn> {
  return {
    name,
    async fetchIncremental() {
      throw new SourceUnavailableError(name, "simulated outage");
    },
    async fetchFull() {
      throw new SourceUnavailableError(name, "simulated outage");
    },
    normalize(record): NormalizedRecord {
      return { entityType: "transaction", source: name, sourceId: record.id, data: {} };
    },
  };
}

describe("sync orchestrator", () => {
  it("falls back to a full backfill when no cursor is on file yet", async () => {
    const source = fakeSource("fake_a");
    const summary = await runSourceSync(source);

    expect(summary.mode).toBe("full_backfill");
    expect(summary.status).toBe("success");
    expect(summary.recordsWritten).toBe(2);

    const rows = await Transaction.findAll({ where: { source: "fake_a" } });
    expect(rows).toHaveLength(2);
  });

  it("uses incremental once a cursor exists, and does not re-backfill", async () => {
    await SyncCursor.upsert({ source: "fake_b", cursorValue: "cursor-1" });
    const source = fakeSource("fake_b");
    const summary = await runSourceSync(source);

    expect(summary.mode).toBe("incremental");
    expect(summary.recordsWritten).toBe(1);
  });

  it("one source being down does not block the others from landing data", async () => {
    const good1 = fakeSource("good_1");
    const good2 = fakeSource("good_2");
    const dead = alwaysDownSource("dead_source");

    const summaries = await runFullSync([good1, dead, good2]);

    const byName = Object.fromEntries(summaries.map((s) => [s.source, s]));
    expect(byName["good_1"].status).toBe("success");
    expect(byName["good_2"].status).toBe("success");
    expect(byName["dead_source"].status).toBe("failed");

    const good1Rows = await Transaction.findAll({ where: { source: "good_1" } });
    const good2Rows = await Transaction.findAll({ where: { source: "good_2" } });
    expect(good1Rows.length).toBeGreaterThan(0);
    expect(good2Rows.length).toBeGreaterThan(0);
  });

  it("re-running the same incremental sync back-to-back does not duplicate rows", async () => {
    await SyncCursor.upsert({ source: "fake_c", cursorValue: "cursor-1" });
    const source = fakeSource("fake_c");

    await runSourceSync(source);
    // cursor advanced to "cursor-2" after first run; simulate the job
    // re-running immediately with the same starting state by resetting the
    // cursor back, mimicking "job re-ran before cursor commit was visible".
    await SyncCursor.upsert({ source: "fake_c", cursorValue: "cursor-1" });
    await runSourceSync(source);

    const rows = await Transaction.findAll({ where: { source: "fake_c" } });
    expect(rows).toHaveLength(1); // upsert on (source, source_id) collapsed both runs
  });
});
