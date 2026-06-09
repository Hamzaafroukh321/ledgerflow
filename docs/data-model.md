# Data Model

LedgerFlow stores catalog, usage, customer, subscription, and saved simulation data behind repository adapters. SQLite remains the local default; Postgres is selected with `LEDGERFLOW_DB_URL`.

## Tables

| Table | Primary key | Purpose |
| --- | --- | --- |
| `tenants` | `id` | Tenant records used for data isolation. |
| `users` | `id` | Principal records resolved from API tokens. |
| `memberships` | `(tenant_id, user_id)` | Principal membership and role per tenant. |
| `plans` | `id` | Billing plan catalog with JSON price components and tenant ownership. |
| `coupons` | `code` | Discount definitions and redemption counters with tenant ownership. |
| `usage_events` | `idempotency_key` | Idempotent metered usage events with tenant ownership. |
| `customers` | `id` | Billing customer profile and tax metadata with tenant ownership. |
| `subscriptions` | `(customer_id, plan_id, starts_on)` | Customer plan assignments over time with tenant ownership. |
| `simulation_runs` | `id` | Saved invoice simulation contexts and results with tenant ownership. |

## Runtime Selection

- No database env: in-memory repositories for tests and CLI defaults.
- `LEDGERFLOW_DB`: SQLite repositories at the configured path.
- `LEDGERFLOW_DB_URL`: Postgres repository with migrations applied on startup.

`LEDGERFLOW_DB_URL` takes precedence over `LEDGERFLOW_DB` because hosted deployments should use the network database.

## Migrations

Migration files live in `src/data/migrations/` and are reversible:

- `001_initial.up.sql`
- `001_initial.down.sql`
- `002_tenants.up.sql`
- `002_tenants.down.sql`

The initial migration creates the core LedgerFlow persistence surface. The tenant migration adds tenant, user, membership, ownership columns, and tenant-first indexes. Build output includes the SQL files under `dist/data/migrations/`.
