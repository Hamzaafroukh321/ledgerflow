# API Authentication

LedgerFlow protects every operational API route with a bearer token when `LEDGERFLOW_API_TOKEN` is set. `/health`, `/openapi.json`, and `/docs` stay public so operators can check readiness and API shape.

## Server Configuration

Set these environment variables before hosting:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `LEDGERFLOW_API_TOKEN` | Production yes | unset | Required bearer token for API calls. When unset, the API starts in open mode and logs a warning. |
| `LEDGERFLOW_API_TOKENS` | Multi-tenant deployments | unset | Comma-separated `token:tenantId[:subject[:role]]` entries. Role is `viewer`, `editor`, or `admin`; omitted role defaults to `admin`. |
| `LEDGERFLOW_BODY_LIMIT_BYTES` | No | `1048576` | Maximum JSON request body size. |
| `LEDGERFLOW_RATE_LIMIT_MAX` | No | `300` | Maximum requests per rate-limit window. |
| `LEDGERFLOW_RATE_LIMIT_WINDOW` | No | `1 minute` | Rate-limit window accepted by `@fastify/rate-limit`. |
| `LEDGERFLOW_DB` | No | in-memory | SQLite path for durable local or container storage. |
| `LEDGERFLOW_DB_URL` | Hosted database | unset | Postgres connection string. Takes precedence over `LEDGERFLOW_DB`. |
| `LEDGERFLOW_SERVE_WEB` | No | unset | Set to `1` to serve the built console from the API process. |
| `LEDGERFLOW_WEB_ROOT` | No | `web/dist` | Console build directory when static serving is enabled. |

Start the API with an explicit token:

```bash
npm run build
node dist/cli/index.js serve --port 3000 --api-token change-me
```

Or use the environment:

```bash
LEDGERFLOW_API_TOKEN=change-me node dist/cli/index.js serve --port 3000
```

For multiple tenants, provide one entry per tenant:

```bash
LEDGERFLOW_API_TOKENS=token-a:tenant-a:user-a:viewer,token-b:tenant-b:user-b:editor node dist/cli/index.js serve --port 3000
```

Docker Compose requires `LEDGERFLOW_API_TOKEN`:

```bash
LEDGERFLOW_API_TOKEN=change-me docker compose up --build
```

## Client Requests

Send the token as a standard bearer credential:

```http
Authorization: Bearer change-me
```

The browser console reads `VITE_LEDGERFLOW_API_TOKEN` at build time and sends the bearer header through `web/src/lib/apiClient.ts`.

## Open Mode

If `LEDGERFLOW_API_TOKEN` is unset, LedgerFlow keeps local development working and logs:

```text
LEDGERFLOW_API_TOKEN is unset; API authentication is in open mode.
```

Open mode is for local development only. Hosted environments should set `LEDGERFLOW_API_TOKEN` and use the default Docker Compose guard.
