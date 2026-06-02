# Roadmap

LedgerFlow should keep growing around deterministic billing operations, not payment processing.

## Near Term

- Persist customers and subscription assignments through SQLite repositories.
- Add migration coverage for existing SQLite data.
- Expand invoice audit rules for trace coverage, duplicate line identifiers, and tax jurisdiction consistency.
- Add export flows for invoice JSON and audit reports.
- Make frontend filters drive both visible tables and summary cards from the same state.

## Medium Term

- Add invoice persistence and lookup-backed refund simulation.
- Track coupon redemptions atomically when simulations commit usage or invoices.
- Add organization-level configuration for tax rates, default currency, and plan visibility.
- Add deterministic pagination and sorting on operational API endpoints.

## Silver Task Backlog Themes

- Cross-module consistency between engine, audit, API schemas, and frontend rendering.
- Idempotency and conflict handling in usage ingestion.
- Persistence behavior under SQLite restarts and migrations.
- Frontend recovery from typed and untyped backend errors.
- Packaging and verification reliability across Windows and CI.
