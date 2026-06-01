# Release Checklist

Use this checklist before handing LedgerFlow to users or deploying the API.

## Required Checks

```sh
npm ci
npm run lint
npm run typecheck
npm test -- --coverage
npm run build
bash scripts/smoke.sh
bash scripts/scan.sh
docker build .
docker compose up
```

Verify `GET /health` returns `{ "status": "ok" }` while Compose is running.

## Artifact Checks

- `dist/` is generated only by build and is not committed.
- `coverage/` is generated only by tests and is not committed.
- `node_modules/` is not committed.
- ZIP packages include `.git/HEAD` and exclude generated folders.

## Product Checks

- `ledgerflow plans` prints default catalog plans.
- `ledgerflow simulate --input examples/invoice-basic.json` returns `totals.total`.
- `ledgerflow validate-coupon --code SAVE20 --input examples/invoice-coupon-stack.json` returns `{ "valid": true }`.
- `ledgerflow refund --invoice examples/refund-partial.json --amount 1000 --strategy proportional` returns a credit note.
- Fresh API server returns default plans from `GET /plans`.
- `LEDGERFLOW_DB` uses SQLite-backed repositories.

## Known MVP Limits

- Invoices are simulated and not persisted by default.
- Coupon redemption counts are modeled but not atomically incremented by simulation.
- Tax rates are simple configured percentages, not an external tax authority integration.
- Refund simulation accepts an invoice payload rather than looking up stored invoices.
