# Production Runbook

This runbook describes the supported production-style Docker Compose path for LedgerFlow
0.2.0. It brings up the single-process web/API image with a private Postgres service and
requires API authentication.

## Prerequisites

- Docker Desktop or Docker Engine with Compose v2.
- A long random `LEDGERFLOW_API_TOKEN` delivered through the runtime environment.
- Port `3000` available, or set `LEDGERFLOW_PORT` to another host port.

## Deploy From Scratch

```powershell
$env:LEDGERFLOW_API_TOKEN = "<runtime-token>"
docker compose -f docker-compose.prod.yml up -d --build
```

Open `http://127.0.0.1:3000/` for the console. The container serves the React console,
`/docs`, `/openapi.json`, and API routes from one image.

The app selects Postgres through `LEDGERFLOW_DB_URL`. On startup it applies all repository
migrations before registering routes, then seeds the default plan and coupon catalog if needed.

## Verification

```powershell
.\scripts\verify-release.ps1
```

The release verifier uses the production compose file, checks `/health`, confirms `/v1/plans`
rejects requests without a bearer token, checks authenticated `/ready`, confirms the seeded
plan catalog is visible, and removes its temporary Compose project.

Manual checks:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/ready -Headers @{ Authorization = "Bearer $env:LEDGERFLOW_API_TOKEN" }
Invoke-RestMethod http://127.0.0.1:3000/v1/plans -Headers @{ Authorization = "Bearer $env:LEDGERFLOW_API_TOKEN" }
```

## Upgrade

1. Read `docs/CHANGELOG.md`.
2. Build and verify the new image:

   ```powershell
   .\scripts\verify.ps1
   .\scripts\verify-release.ps1
   ```

3. Recreate the stack:

   ```powershell
   docker compose -f docker-compose.prod.yml up -d --build
   ```

Migrations are reversible in source and applied upward on startup for hosted Postgres.

## Rollback

1. Check the current image tag and release notes.
2. Restore the previous image or checkout the previous tag.
3. Run:

   ```powershell
   docker compose -f docker-compose.prod.yml up -d --build
   ```

If a database migration must be reversed, run the matching down migration only after reviewing
the data impact.

## Runtime Operations

- Logs are JSON when `LEDGERFLOW_LOGS=1`.
- `/health` is public liveness.
- `/ready` requires a bearer token and verifies repository reachability.
- `/metrics` requires a bearer token and exposes Prometheus text metrics.
- Postgres is not published to the host in the production compose file.
- LedgerFlow never moves money or contacts payment processors.
