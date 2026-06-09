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
.\scripts\verify-release.ps1
```

Verify `GET /health` returns `{ "status": "ok" }` while Compose is running.

## Artifact Checks

- `dist/` is generated only by build and is not committed.
- `coverage/` is generated only by tests and is not committed.
- `node_modules/` is not committed.
- ZIP packages include `.git/HEAD` and exclude generated folders.
- The production compose file keeps Postgres private to the Compose network.
- `LEDGERFLOW_API_TOKEN` is required before the production compose stack starts.

## Product Checks

- `ledgerflow plans` prints default catalog plans.
- `ledgerflow simulate --input examples/invoice-basic.json` returns `totals.total`.
- `ledgerflow validate-coupon --code SAVE20 --input examples/invoice-coupon-stack.json` returns `{ "valid": true }`.
- `ledgerflow refund --invoice examples/refund-partial.json --amount 1000 --strategy proportional` returns a credit note.
- Fresh API server returns default plans from `GET /plans`.
- `LEDGERFLOW_DB` uses SQLite-backed repositories.
- `LEDGERFLOW_DB_URL` uses Postgres-backed repositories and applies migrations on API startup.
- `docker compose -f docker-compose.prod.yml up -d --build` brings up a secured, migrated instance.

## Release Version Checks

- `package.json`, `package-lock.json`, CLI `program.version`, and OpenAPI `info.version` match.
- `docs/CHANGELOG.md` has a dated release section for the version.
- Create the local release tag after the release commit:

```powershell
git tag v0.2.0
```

## Known MVP Limits

- Invoices are simulated and not persisted by default.
- Coupon redemption counts are modeled but not atomically incremented by simulation.
- Tax rates are simple configured percentages, not an external tax authority integration.
- Refund simulation accepts an invoice payload rather than looking up stored invoices.
