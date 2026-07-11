-- ============================================================================
-- 001_init.sql
-- Normalized schema for: CRM contacts, calendar events, payment transactions.
-- Plus sync-state tracking (cursors, run log, webhook de-dup) and the single
-- canonical "collected revenue" view that both metrics endpoints read from.
-- ============================================================================

-- ---------- Enums ----------

DO $$ BEGIN
  CREATE TYPE canonical_txn_status AS ENUM
    ('collected', 'pending', 'failed', 'refunded', 'voided', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sync_run_status AS ENUM ('success', 'partial', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Normalized entities ----------

CREATE TABLE IF NOT EXISTS contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source           TEXT NOT NULL,             -- 'hubspot'
  source_id        TEXT NOT NULL,             -- HubSpot contact id (external, immutable)
  email            TEXT,
  full_name        TEXT,
  company          TEXT,
  lifecycle_stage  TEXT,
  source_updated_at TIMESTAMPTZ,              -- what the source calls "last modified"
  raw              JSONB NOT NULL,             -- untouched source payload, for auditing
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)                  -- <-- idempotency key
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source           TEXT NOT NULL,             -- 'google_calendar'
  source_id        TEXT NOT NULL,             -- Google event id
  title            TEXT,
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  attendee_emails  TEXT[],
  status           TEXT,                       -- confirmed/cancelled/tentative
  source_updated_at TIMESTAMPTZ,
  raw              JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)                  -- <-- idempotency key
);

CREATE TABLE IF NOT EXISTS transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source            TEXT NOT NULL,            -- 'stripe', 'hubspot_payments', etc.
  source_id         TEXT NOT NULL,            -- charge/invoice id from source
  amount_cents      BIGINT NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'usd',
  raw_status        TEXT NOT NULL,            -- source's own vocabulary ('succeeded','paid',...)
  canonical_status  canonical_txn_status NOT NULL, -- mapped once, at ingestion time
  occurred_at       TIMESTAMPTZ NOT NULL,     -- transaction date, used for date-range queries
  source_updated_at TIMESTAMPTZ,
  raw               JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)                  -- <-- idempotency key
);

CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions (occurred_at);
CREATE INDEX IF NOT EXISTS idx_transactions_canonical_status ON transactions (canonical_status);

-- ---------- Sync-state tracking ----------

CREATE TABLE IF NOT EXISTS sync_cursors (
  source        TEXT PRIMARY KEY,             -- 'hubspot' | 'google_calendar' | 'stripe'
  cursor_value  TEXT,                          -- opaque cursor/timestamp string
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source         TEXT NOT NULL,
  mode           TEXT NOT NULL,                -- 'incremental' | 'full_backfill'
  status         sync_run_status NOT NULL,
  records_seen   INT NOT NULL DEFAULT 0,
  records_written INT NOT NULL DEFAULT 0,
  records_failed INT NOT NULL DEFAULT 0,
  error_message  TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ
);

-- De-dupes webhook deliveries independent of the upsert-key de-dup on the
-- entity tables themselves -- belt and suspenders for "fires twice".
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  source           TEXT NOT NULL,
  delivery_id      TEXT NOT NULL,              -- source's own event/delivery id
  received_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, delivery_id)
);

-- ============================================================================
-- CANONICAL REVENUE DEFINITION
--
-- This is the ONLY place "collected" is defined. Both the summary endpoint
-- and the breakdown endpoint select FROM this view -- they cannot drift
-- because there is only one WHERE clause in the whole system, enforced by
-- Postgres, not by two pieces of app code agreeing to stay in sync.
--
-- Allow-list, not exclude-list: canonical_status = 'collected' is set
-- explicitly at ingestion time (see src/normalize/statusMap.ts) from a
-- per-source map. Any raw status the map doesn't recognize is normalized to
-- 'unknown' and therefore, by construction, does NOT appear in this view.
-- ============================================================================

CREATE OR REPLACE VIEW collected_transactions AS
SELECT *
FROM transactions
WHERE canonical_status = 'collected';
