# Operations

LedgerFlow runs as a local CLI, a Fastify API, a Vite frontend during development, and a single Docker image in production-style runs.

## Local Verification

Use the PowerShell verifier on Windows:

```powershell
.\scripts\verify.ps1
```

Useful variants:

```powershell
.\scripts\verify.ps1 -SkipDocker
.\scripts\verify.ps1 -SkipE2E
.\scripts\count_tests.ps1
```

The full verifier runs root lint/typecheck/tests/build, scan and smoke scripts through Git Bash when available, web lint/typecheck/coverage/build, Playwright e2e, and Docker Compose build.

## Runtime Modes

- CLI: `node dist/cli/index.js plans --pretty`
- API only: `node dist/cli/index.js serve --port 3000`
- Web development: run the API on port 3000, then `cd web && npm run dev`
- Compose: `docker compose up --build`

Compose sets `LEDGERFLOW_DB=/data/ledgerflow.sqlite` and serves the built frontend from `/app/web/dist`.

## Hosted API Token

Set `LEDGERFLOW_API_TOKEN` in hosted or shared environments to require a token
on operational API routes. Clients can send either `Authorization: Bearer
<token>` or `x-ledgerflow-token: <token>`. Health checks, Swagger UI,
`/openapi.json`, and static web assets remain public.

The browser console can send the same header when it is built with
`VITE_LEDGERFLOW_API_TOKEN`, or custom clients can pass the token explicitly.

## Persistence

SQLite-backed repositories are enabled only when `LEDGERFLOW_DB` is set. The default in-memory mode is useful for tests and demos. Docker Compose mounts `ledgerflow-data` at `/data`, so usage events, plans, and coupons survive container restarts.

## Release Artifact

Run `scripts/package.sh` through Git Bash after verification. The package script builds `ledgerflow.zip` from tracked files plus `.git/HEAD`; generated output and dependency folders remain excluded.
