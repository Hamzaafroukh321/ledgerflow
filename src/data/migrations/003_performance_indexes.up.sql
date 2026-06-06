CREATE INDEX IF NOT EXISTS plans_tenant_name_idx ON plans (tenant_id, name, id);
CREATE INDEX IF NOT EXISTS coupons_tenant_kind_code_idx ON coupons (tenant_id, kind, code);
CREATE INDEX IF NOT EXISTS usage_events_tenant_ts_idx ON usage_events (tenant_id, ts, idempotency_key);
CREATE INDEX IF NOT EXISTS customers_tenant_name_idx ON customers (tenant_id, name, id);
CREATE INDEX IF NOT EXISTS simulation_runs_tenant_id_idx ON simulation_runs (tenant_id, id);
