DROP INDEX IF EXISTS simulation_runs_tenant_created_idx;
DROP INDEX IF EXISTS subscriptions_tenant_customer_starts_idx;
DROP INDEX IF EXISTS customers_tenant_id_idx;
DROP INDEX IF EXISTS usage_events_tenant_customer_ts_idx;
DROP INDEX IF EXISTS coupons_tenant_code_idx;
DROP INDEX IF EXISTS plans_tenant_id_idx;

ALTER TABLE simulation_runs DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE customers DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE usage_events DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE coupons DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE plans DROP COLUMN IF EXISTS tenant_id;

DROP TABLE IF EXISTS memberships;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS tenants;
