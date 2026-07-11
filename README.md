# sync-metrics-service

Two things, sharing one Postgres database:

1. **A sync pipeline** that ingests HubSpot (CRM), Google Calendar (events),
   and Stripe (payments) into one normalized schema — idempotently, with
   automatic full-backfill fallback on a stale cursor, and with each source
   isolated so one outage doesn't wedge the others.
2. **A metrics service** that computes "total revenue collected" for any
   date range, from an allow-list of statuses, through exactly one code
   path — so a summary endpoint and a breakdown endpoint can never disagree.

Stack: Node.js, Express, TypeScript, Sequelize, Postgres (Supabase).

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, HUBSPOT_API_KEY, STRIPE_SECRET_KEY, GOOGLE_SERVICE_ACCOUNT_JSON
npm run migrate         # applies migrations/001_init.sql to your Supabase DB
npm run seed             # optional: loads sample data without needing live creds
npm run dev               # starts the API on :3000
```

**External accounts needed** (all free/test-mode):
- **Supabase**: create a project, copy the connection string into
  `DATABASE_URL`, set `DB_SSL=true`.
- **HubSpot**: free developer test account → create a Private App → copy
  its access token into `HUBSPOT_API_KEY`. Seed a handful of contacts by
  hand in the HubSpot UI.
- **Google Calendar**: create a Cloud project, enable the Calendar API,
  create a service account, share your calendar with its email, point
  `GOOGLE_SERVICE_ACCOUNT_JSON` at the downloaded key file. Seed a few
  events by hand.
- **Stripe**: use your account's test-mode secret key
  (`sk_test_...`) — create a handful of test charges via the Stripe
  dashboard or `stripe fixtures`.

## Running the pipeline

```bash
npm run sync              # one-off: pulls all three sources, prints per-source summary
curl -X POST localhost:3000/sync/run    # same thing, over HTTP
curl localhost:3000/sync/runs           # audit log of past runs, per source
```

## Querying revenue

```bash
curl "localhost:3000/metrics/revenue/summary?startDate=2026-01-01&endDate=2026-02-01"
curl "localhost:3000/metrics/revenue/breakdown?startDate=2026-01-01&endDate=2026-02-01&granularity=day"
curl "localhost:3000/metrics/revenue/consistency-check?startDate=2026-01-01&endDate=2026-02-01"
```

## Tests

```bash
npm run migrate            # against a disposable test DB
DATABASE_URL=<test-db-url> npm test
```

- `tests/statusMap.test.ts` — pure unit test of the allow-list; proves any
  unrecognized status maps to `unknown`, never to `collected`.
- `tests/idempotency.test.ts` — re-running the same write, and the same
  webhook delivery id, twice never produces a second row.
- `tests/syncOrchestrator.test.ts` — stale/missing cursor triggers a full
  backfill; a dead source doesn't block the other two; back-to-back reruns
  don't duplicate.
- `tests/metrics.consistency.test.ts` — the actual drift-detection test:
  sums the breakdown and asserts it equals the summary total, including
  with an unrecognized status present, and demonstrates how a naive
  exclude-list implementation *would* diverge from the canonical one.

---

## How each requirement is met

### 1. Normalized schema despite differently-shaped sources
`src/sources/{hubspot,googleCalendar,stripe}Source.ts` each implement the
same `SourceAdapter<T>` interface (`src/sources/types.ts`) with a
`normalize()` method that maps that source's field names into one of three
normalized shapes (`contacts`, `calendar_events`, `transactions` in
`migrations/001_init.sql`). The pipeline code never branches on which
source it's talking to.

### 2. Stale-cursor fallback instead of losing data or crashing
Each adapter throws a typed `StaleCursorError` when the source rejects the
cursor it was given (HubSpot 410/401, Google Calendar 410 on an expired
`syncToken`, Stripe 400 `resource_missing` on a dead `starting_after`
pointer, or simply "no cursor on file yet"). `runSourceSync` in
`src/pipeline/syncOrchestrator.ts` catches specifically that error type and
transparently switches to `fetchFull()`, paging through the entire dataset,
before persisting a fresh cursor. A generic `SourceUnavailableError` is
handled differently (see below) — the two are not conflated.

### 3. Idempotent writes
Every normalized table has a `UNIQUE (source, source_id)` constraint
(`migrations/001_init.sql`). All writes go through
`src/pipeline/upsert.ts`, which uses Sequelize's `upsert()` — compiled to
`INSERT ... ON CONFLICT (source, source_id) DO UPDATE`. Running the sync
job twice, or replaying a full backfill after a partial incremental
already landed, always converges on one row per external record.
Webhooks get a second, independent layer: `processed_webhook_events
(source, delivery_id)` PRIMARY KEY rejects a second delivery of the same
event id before it ever reaches the entity tables
(`src/routes/webhookRoutes.ts`).

### 4. One source down doesn't wedge the other two
`runFullSync` (`src/pipeline/syncOrchestrator.ts`) uses
`Promise.allSettled`, and `runSourceSync` itself never throws — any
failure (network error, 5xx, garbage payload it can't even parse) is
caught and turned into a `{status: "failed"}` summary plus a `sync_runs`
row, while the other sources' promises keep running independently. Within
a single source, a malformed individual record (fails Zod validation, or
fails to write) is also isolated: `writeAll()` in the orchestrator
try/catches per-record and counts failures rather than aborting the batch,
so `records_failed > 0` shows up as a `"partial"` run instead of losing the
whole page's worth of good records.

### 5. One canonical "collected" definition, allow-list based
`src/normalize/statusMap.ts` holds one map per source, translating that
source's status vocabulary (`paid`, `succeeded`, `completed`, ...) into a
small canonical enum. Anything not explicitly listed becomes `unknown` —
not swallowed, not guessed — and is logged for follow-up. `unknown` is, by
construction, absent from `COLLECTED_STATUSES = ['collected']`, so a brand
new or misspelled status can never silently count as revenue.

### 6. Two views, guaranteed to agree
The database has exactly one definition of "collected":
`CREATE VIEW collected_transactions AS SELECT * FROM transactions WHERE
canonical_status = 'collected'`. Both `getRevenueTotal` and
`getRevenueBreakdown` in `src/metrics/revenueQuery.ts` — and therefore both
the `/metrics/revenue/summary` and `/metrics/revenue/breakdown` endpoints —
select `FROM collected_transactions`. There's no second WHERE clause
anywhere in the app to drift out of sync with the first.

### 7. Something would actually catch a second implementation
Three independent guardrails:
- `assertRevenueConsistency()` sums the breakdown and compares it to the
  summary total; wired up at `GET
  /metrics/revenue/consistency-check`, which 500s on mismatch and can be
  put on a monitor.
- `tests/metrics.consistency.test.ts` runs that check against real seeded
  data (multiple sources, an unrecognized status mixed in) as part of
  `npm test` / CI, and includes a fixture that shows a naive
  exclude-list implementation *actually diverging* from the canonical one
  once a `refunded` row is introduced — demonstrating exactly the failure
  mode a second ad-hoc implementation would hit.
- Structurally, both endpoints are physically incapable of using a
  different status list because there is only one Postgres view; a second
  implementation would have to explicitly bypass it, which is what the
  test above is designed to notice.
