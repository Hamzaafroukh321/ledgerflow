# Frontend

The LedgerFlow frontend is a Vite, React, TypeScript, Tailwind, React Query, React Hook Form, and Zod app in `web/`.

## Local development

Run the API first:

```sh
npm install
npm run build
node dist/cli/index.js serve --port 3000
```

Then run the UI:

```sh
cd web
npm install
npm run dev
```

Vite proxies `/api/*` to `http://127.0.0.1:3000`, so the browser uses same-origin `/api` calls in development.

## Production serving

The Docker image builds both the server and `web/dist`. Runtime static hosting is enabled by:

```sh
LEDGERFLOW_SERVE_WEB=1
LEDGERFLOW_WEB_ROOT=/app/web/dist
```

`GET /` and client routes such as `/simulator` serve the React app when the request accepts HTML. API routes, `/docs`, and `/openapi.json` remain available from the same origin.

## Screens

- Overview: summarizes available operations and links into the major workflows.
- Plans: lists catalog plans returned by `GET /plans`.
- Simulator: builds a billing context, calls `POST /invoices/simulate`, renders the invoice, and shows the explanation trace.
- Audit: validates pasted invoice JSON with `POST /invoices/audit` and groups findings by severity.
- Scenarios: sends baseline and candidate contexts to `POST /scenarios/compare` and renders total/tax/discount/credit deltas.
- Customers: creates customers, assigns subscriptions, and loads billing profiles through `/customers`, `/subscriptions`, and `/customers/:customerId/billing-profile`.
- Usage: ingests events, lists accepted events, and aggregates meters through `/usage/events` and `/usage/aggregate`.
- Refunds: simulates proportional or sequential refunds with `POST /refunds/simulate`.

## Verification

```sh
cd web
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run e2e
```

The coverage gate is enforced in `web/vite.config.ts`. Playwright starts an isolated API server and Vite dev server on high ports so stale local services do not affect results.
