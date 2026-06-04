# Testing and Verification

LedgerFlow uses separate backend and frontend verification commands. CI runs the same checks on Node 20 and Node 22, with coverage thresholds set to at least 90% for statements, branches, functions, and lines.

## Command Reference

Run the backend service checks:

```bash
npm ci
npm run lint
npm run typecheck
npm run coverage
npm run build
npm run bench
```

Run the frontend checks:

```bash
npm --prefix web ci
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run test:coverage
npm --prefix web run build
npm --prefix web run e2e
```

Run the full local verifier:

```powershell
.\scripts\verify.ps1
```

Use `-SkipDocker` when Docker Desktop is not running locally. CI still runs `docker compose build`.

## Current Baseline

Measured during Phase 0 on 2026-06-04:

- Backend coverage: 21 test files, 94 tests passing, 95.19% statements, 90.12% branches.
- Frontend coverage: 20 test files, 59 tests passing, 99.40% statements, 90.27% branches.
- Backend build: passing.
- Frontend build: passing.
- Local Docker build: passing with `docker compose build`.

## Golden and Contract Coverage

Backend golden tests live in `test/golden/` and compare deterministic invoice outputs for every committed invoice example. `test/openapi.contract.test.ts` compares the generated OpenAPI document with `test/openapi/openapi.snapshot.json`.

After dependency upgrades, run `npm run coverage` and confirm both golden invoice snapshots and the OpenAPI snapshot still match byte-for-byte.

## Latency Baseline

Run:

```bash
npm run bench
```

The Phase 0 baseline used 1000 iterations per invoice example. Slowest p95 was `invoice-usage.json` at 0.0997ms. The full baseline:

| Example | Average ms | p95 ms | Max ms |
| --- | ---: | ---: | ---: |
| invoice-basic.json | 0.0325 | 0.0650 | 3.4163 |
| invoice-usage.json | 0.0346 | 0.0997 | 0.6442 |
| invoice-proration.json | 0.0304 | 0.0860 | 0.4004 |
| invoice-coupon-stack.json | 0.0300 | 0.0695 | 0.6244 |
| invoice-tax-exempt.json | 0.0158 | 0.0267 | 0.8245 |
| invoice-inclusive-tax.json | 0.0127 | 0.0136 | 0.2707 |
| invoice-reverse-charge.json | 0.0095 | 0.0116 | 0.1481 |
| invoice-over-credit.json | 0.0173 | 0.0356 | 1.0019 |
