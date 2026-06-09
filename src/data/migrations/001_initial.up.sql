CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL,
  components_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  value INTEGER NOT NULL,
  redemption_limit INTEGER,
  applies_to JSONB,
  stackable BOOLEAN NOT NULL,
  redeemed_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS usage_events (
  idempotency_key TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  meter TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  tax_profile_json JSONB NOT NULL,
  metadata_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  customer_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  seats INTEGER NOT NULL,
  ends_on TEXT,
  PRIMARY KEY (customer_id, plan_id, starts_on)
);

CREATE TABLE IF NOT EXISTS simulation_runs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  context_json JSONB NOT NULL,
  invoice_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS usage_events_customer_ts_idx ON usage_events (customer_id, ts);
CREATE INDEX IF NOT EXISTS subscriptions_customer_starts_idx ON subscriptions (customer_id, starts_on);
CREATE INDEX IF NOT EXISTS simulation_runs_created_idx ON simulation_runs (created_at DESC, id);
