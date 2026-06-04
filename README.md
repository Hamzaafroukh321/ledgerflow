# LedgerFlow

LedgerFlow is a deterministic billing rules engine and invoice simulation toolkit for SaaS teams. It turns a billing context into a fully explained invoice without moving money or contacting payment processors.

## Install

```sh
npm install
npm run build
```

## Development

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

On Windows, the full local verifier is:

```powershell
.\scripts\verify.ps1
.\scripts\count_tests.ps1
```

The browser console lives in `web/`:

```sh
cd web
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to a local API server on port 3000. Start the API in another shell with `npm run build && node dist/cli/index.js serve --port 3000`. For a production-style single process, run `docker compose up --build` and open `http://127.0.0.1:3000/`; the same container serves the React app, `/docs`, `/openapi.json`, and API routes.

## Authentication

Set `LEDGERFLOW_API_TOKEN` before hosting LedgerFlow. When the token is set, every operational API route requires `Authorization: Bearer <token>`; `/health`, `/openapi.json`, and `/docs` remain public. Local development can run without a token, but the server logs an open-mode warning.

```sh
npm run build
node dist/cli/index.js serve --port 3000 --api-token change-me
```

The browser console sends `VITE_LEDGERFLOW_API_TOKEN` as a bearer token. See `docs/auth.md` for all auth, body-size, and rate-limit environment variables.

## CLI Quick Start

```sh
npm run build
node dist/cli/index.js plans --pretty
node dist/cli/index.js simulate --input examples/invoice-basic.json --pretty --trace
node dist/cli/index.js validate-coupon --code SAVE20 --input examples/invoice-coupon-stack.json
node dist/cli/index.js refund --invoice examples/refund-partial.json --amount 1000 --strategy proportional
```

## API Quick Start

```sh
node dist/cli/index.js serve --port 3000
```

Endpoints include `GET /health`, `GET /plans`, `POST /invoices/simulate`, `POST /invoices/audit`, `POST /scenarios/compare`, `POST /usage/events`, `POST /usage/aggregate`, `POST /coupons/validate`, `POST /refunds/simulate`, `GET /customers`, `POST /customers`, `POST /subscriptions`, and `GET /customers/:customerId/billing-profile`.

Interactive API documentation is available at `/docs`; the raw OpenAPI document is available at `/openapi.json`.

## Worked Example

`examples/invoice-usage.json` charges five Pro seats plus API overage. The invoice response contains line items, discounts, credits, taxes, totals, and an explanation trace whose children reconcile to the invoice total.
