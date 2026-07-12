DO $$ BEGIN
  CREATE TYPE canonical_txn_status AS ENUM
    ('collected', 'pending', 'failed', 'refunded', 'voided', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sync_run_status AS ENUM ('success', 'partial', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source           TEXT NOT NULL,             
  source_id        TEXT NOT NULL,             
  email            TEXT,
  full_name        TEXT,
  company          TEXT,
  lifecycle_stage  TEXT,
  source_updated_at TIMESTAMPTZ,              
  raw              JSONB NOT NULL,             
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)                  
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source           TEXT NOT NULL,             
  source_id        TEXT NOT NULL,             
  title            TEXT,
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  attendee_emails  TEXT[],
  status           TEXT,                       
  source_updated_at TIMESTAMPTZ,
  raw              JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)                 
);

CREATE TABLE IF NOT EXISTS transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source            TEXT NOT NULL,            
  source_id         TEXT NOT NULL,           
  amount_cents      BIGINT NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'usd',
  raw_status        TEXT NOT NULL,          
  canonical_status  canonical_txn_status NOT NULL,
  occurred_at       TIMESTAMPTZ NOT NULL,    
  source_updated_at TIMESTAMPTZ,
  raw               JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)                 
);

CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions (occurred_at);
CREATE INDEX IF NOT EXISTS idx_transactions_canonical_status ON transactions (canonical_status);


CREATE TABLE IF NOT EXISTS sync_cursors (
  source        TEXT PRIMARY KEY,             
  cursor_value  TEXT,                          
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source         TEXT NOT NULL,
  mode           TEXT NOT NULL,               
  status         sync_run_status NOT NULL,
  records_seen   INT NOT NULL DEFAULT 0,
  records_written INT NOT NULL DEFAULT 0,
  records_failed INT NOT NULL DEFAULT 0,
  error_message  TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  source           TEXT NOT NULL,
  delivery_id      TEXT NOT NULL,              
  received_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, delivery_id)
);

CREATE OR REPLACE VIEW collected_transactions AS
SELECT *
FROM transactions
WHERE canonical_status = 'collected';
