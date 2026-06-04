# Data Model

LedgerFlow stores catalog, usage, customer, subscription, and saved simulation data behind repository adapters. SQLite remains the local default; Postgres is selected with `LEDGERFLOW_DB_URL`.

## Tables

| Table | Primary key | Purpose |
| --- | --- | --- |
| `plans` | `id` | Billing plan catalog with JSON price components. |
| `coupons` | `code` | Discount definitions and redemption counters. |
| `usage_events` | `idempotency_key` | Idempotent metered usage events. |
| `customers` | `id` | Billing customer profile and tax metadata. |
| `subscriptions` | `(customer_id, plan_id, starts_on)` | Customer plan assignments over time. |
| `simulation_runs` | `id` | Saved invoice simulation contexts and results. |

## Runtime Selection

- No database env: in-memory repositories for tests and CLI defaults.
- `LEDGERFLOW_DB`: SQLite repositories at the configured path.
- `LEDGERFLOW_DB_URL`: Postgres repository with migrations applied on startup.

`LEDGERFLOW_DB_URL` takes precedence over `LEDGERFLOW_DB` because hosted deployments should use the network database.

## Migrations

Migration files live in `src/data/migrations/` and are reversible:

- `001_initial.up.sql`
- `001_initial.down.sql`

The initial migration creates the current LedgerFlow persistence surface without tenant columns. Tenant ownership is added in Phase 3.
