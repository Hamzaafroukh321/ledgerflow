# API

The Fastify server exposes interactive Swagger UI at `/docs` and the generated OpenAPI document at `/openapi.json`.

```sh
npm run build
node dist/cli/index.js serve --port 3000
curl http://127.0.0.1:3000/openapi.json
```

## `GET /health`

Returns `{ "status": "ok" }`.

## `GET /plans`

Returns configured plans.

## `POST /invoices/simulate`

Accepts a billing context and returns an invoice with `lineItems`, `discounts`, `creditsApplied`, `taxLines`, `totals`, and `explanation`.

## `POST /invoices/audit`

Accepts an invoice and returns an audit report with invariant violations for totals, trace reconciliation, signs, currencies, and tax sanity.

## `POST /scenarios/compare`

Accepts `{ "baseline": { "name": "...", "context": {} }, "candidates": [{ "name": "...", "context": {} }] }` and returns simulated invoices plus total deltas between baseline and each candidate.

## `POST /usage/events`

Accepts a usage event keyed by `idempotencyKey`. Duplicate keys return HTTP 409.

## `GET /usage/events`

Returns accepted usage events. This is intended for operational inspection and debugging invoice inputs.

## `POST /usage/aggregate`

Accepts `{ "customerId": "cus_1", "period": { "start": "2025-01-01", "end": "2025-02-01" } }` and returns meter totals for events inside the period. Omit `customerId` to aggregate all accepted usage events.

## `POST /coupons/validate`

Accepts `{ "code": "SAVE20", "context": {} }` and returns coupon validity.

## `POST /refunds/simulate`

Accepts an invoice, `amountMinor`, and refund `strategy`, then returns allocations and a credit note.

## `GET /customers`

Returns stored customer records.

## `POST /customers`

Creates or replaces a customer with tax profile metadata.

## `POST /subscriptions`

Creates or replaces a subscription assignment for a customer.

## `GET /customers/:customerId/billing-profile?onDate=YYYY-MM-DD`

Returns the customer and active subscription assignment for the requested date.

Validation failures return HTTP 400 with `{ "error": { "code": "validation_error", "message": "...", "details": [] } }`.

## Docker Compose

`docker compose up --build` starts a production-style container on `http://127.0.0.1:3000`. The container serves the web app at `/`, Swagger UI at `/docs`, OpenAPI at `/openapi.json`, and the API routes above.

Compose persists SQLite data in the `ledgerflow-data` volume. The default path is `/data/ledgerflow.sqlite`; override it with:

```sh
LEDGERFLOW_DB=/data/custom.sqlite docker compose up --build
```

Troubleshooting:

- If port 3000 is busy, change the published port in `docker-compose.yml`, for example `"3001:3000"`.
- If the app starts but data does not persist, confirm the container uses `/data/...` for `LEDGERFLOW_DB` and the `ledgerflow-data` volume is mounted.
- If `/` returns an API 404 outside Docker, static hosting is disabled. Set `LEDGERFLOW_SERVE_WEB=1` and `LEDGERFLOW_WEB_ROOT` to a built `web/dist` directory.
- If `/docs` works but UI assets do not load, rebuild the image so the `web-build` stage refreshes `web/dist`.
