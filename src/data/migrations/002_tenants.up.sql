CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memberships (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (tenant_id, user_id)
);

INSERT INTO tenants (id, name)
VALUES ('default', 'Default tenant')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email)
VALUES ('api-token', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (tenant_id, user_id, role)
VALUES ('default', 'api-token', 'admin')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

ALTER TABLE plans ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE simulation_runs ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

CREATE INDEX IF NOT EXISTS plans_tenant_id_idx ON plans (tenant_id, id);
CREATE INDEX IF NOT EXISTS coupons_tenant_code_idx ON coupons (tenant_id, code);
CREATE INDEX IF NOT EXISTS usage_events_tenant_customer_ts_idx ON usage_events (tenant_id, customer_id, ts);
CREATE INDEX IF NOT EXISTS customers_tenant_id_idx ON customers (tenant_id, id);
CREATE INDEX IF NOT EXISTS subscriptions_tenant_customer_starts_idx ON subscriptions (tenant_id, customer_id, starts_on);
CREATE INDEX IF NOT EXISTS simulation_runs_tenant_created_idx ON simulation_runs (tenant_id, created_at DESC, id);
