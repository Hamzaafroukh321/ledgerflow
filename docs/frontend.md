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

The console opens on a login screen. Hosted users enter the API base URL and bearer token. Local development can use the local demo session when the API is intentionally running in open mode.

Multi-token deployments can paste tokens in the server format `token:tenantId:subject:role`. The browser derives tenant, subject, and role from that token for display and route guards; the server remains the source of truth for authorization.

Optional Vite environment variables:

| Variable | Purpose |
| --- | --- |
| `VITE_LEDGERFLOW_API_BASE` | Pre-fills the login API base URL. |
| `VITE_LEDGERFLOW_API_TOKEN` | Pre-seeds a controlled-build session token. |
| `VITE_LEDGERFLOW_TENANT_ID` | Pre-seeds the session tenant label when a build token is present. |
| `VITE_LEDGERFLOW_ROLE` | Pre-seeds the console role when a build token is present. |

## Production serving

The Docker image builds both the server and `web/dist`. Runtime static hosting is enabled by:

```sh
LEDGERFLOW_SERVE_WEB=1
LEDGERFLOW_WEB_ROOT=/app/web/dist
```

`GET /` and client routes such as `/simulator` serve the React app when the request accepts HTML. API routes, `/docs`, and `/openapi.json` remain available from the same origin.

## Screens

- Login: stores tenant sessions in browser local storage, supports a local demo session, and switches active tenants from the shell.
- Overview: summarizes available operations and links into the major workflows.
- Plans: lists paginated catalog plans from `GET /v1/plans` and coupons from `GET /v1/coupons`; write controls are hidden from viewers.
- Simulator: builds a billing context, calls `POST /invoices/simulate`, renders the invoice, shows the explanation trace, and can save the run to the simulation library.
- Saved simulations: lists paginated runs from `GET /v1/simulations`, loads selected run detail, and shows the invoice plus explanation trace.
- Audit: validates pasted invoice JSON with `POST /invoices/audit` and groups findings by severity.
- Scenarios: sends baseline and candidate contexts to `POST /scenarios/compare` and renders total/tax/discount/credit deltas.
- Customers: creates customers, assigns subscriptions, and loads billing profiles through `/customers`, `/subscriptions`, and `/customers/:customerId/billing-profile`; hidden for viewer sessions.
- Usage: ingests events, lists accepted events, and aggregates meters through `/usage/events` and `/usage/aggregate`; hidden for viewer sessions.
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
