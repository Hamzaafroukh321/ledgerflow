# API

The Fastify server exposes interactive Swagger UI at `/docs` and the generated OpenAPI document at `/openapi.json`.

All operational routes are available both at the legacy root path and under `/v1`. New integrations should prefer `/v1`.

Every response includes an `x-request-id` header. Send `x-request-id` to make logs and error envelopes use your caller-generated value; otherwise LedgerFlow generates one for the request.

```sh
npm run build
node dist/cli/index.js serve --port 3000
curl http://127.0.0.1:3000/openapi.json
```

## Authentication

Local development runs without authentication by default. For hosted or shared
environments, set `LEDGERFLOW_API_TOKEN` before starting the server:

```sh
LEDGERFLOW_API_TOKEN=change-me node dist/cli/index.js serve --port 3000
```

When this variable is set, operational API routes require either
`Authorization: Bearer <token>` or `x-ledgerflow-token: <token>`.
`GET /health`, `/docs`, `/openapi.json`, and static web assets remain public so
load balancers, documentation, and the web shell can load normally.

## `GET /health`

Returns `{ "status": "ok" }`.

## `GET /plans`

Returns configured plans.

Under `/v1`, list routes return a page envelope:

```json
{
  "data": [],
  "page": {
    "limit": 50,
    "total": 0,
    "nextCursor": null
  }
}
```

Use `?limit=25` to set the page size, up to 100. When `nextCursor` is not null, pass it back as `?cursor=<value>` to fetch the next stable page. This envelope applies to `GET /v1/plans`, `GET /v1/simulations`, `GET /v1/usage/events`, `GET /v1/customers`, and `GET /v1/memberships`.

## `POST /plans`

Creates or replaces a plan. Send `Idempotency-Key` to make retries replay the original response for the same tenant, subject, method, route, key, and body. Reusing the same key with different content returns HTTP 409 with `idempotency_conflict`.

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

## `POST /simulations`

Saves an invoice simulation run. Send `Idempotency-Key` to make retrying the same request replay the original saved run instead of creating a duplicate.

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

## `GET /memberships`

Admin-only. Returns memberships for the caller's tenant.

## `POST /memberships`

Admin-only. Creates or replaces a tenant membership with `userId`, `role`, and optional `email`.

## Error Envelope

Errors use a stable envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": [],
    "requestId": "req_..."
  }
}
```

Validation failures return HTTP 400. Permission failures return HTTP 401 or 403. Rate limits return HTTP 429. Not-found routes and missing records return HTTP 404. Idempotency conflicts return HTTP 409.

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
