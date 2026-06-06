# PROGRESS

## MORNING SUMMARY
- phases completed: Phase 0 through Phase 10 are implemented and verified on per-phase branches.
- current branch state: `feat/phase10-release-readiness` with release work ready to commit; `main` was not touched and nothing was pushed.
- total tests + coverage: backend 160 passing; frontend 99 passing at 97.61% statements / 91.24% branches; Playwright 2 passing; Docker build passing; production release verifier passing.
- blockers waiting on you: none.
- exact next step: review `feat/phase10-release-readiness`; push or merge only when you are ready.

## [21:07] Phase 0 - Baseline lock, safety nets and dependency refresh  (DONE)
- branch: feat/phase0-baseline   commit: c3bf5aa
- what changed:
  - Copied the scaling playbook into the repo and committed it.
  - Scoped backend coverage to backend source files and raised the gate to 90/90/90/90.
  - Added deterministic invoice golden fixtures, an OpenAPI snapshot, and property/invariant coverage.
  - Added focused backend branch coverage locks for pure helper modules.
  - Added frontend edge-path tests to lift branch coverage over the Phase 0 gate.
  - Migrated ESLint to v9 flat config, upgraded Zod to v4, added CI Node 20/22 and Docker gates, and documented the local workflow.
- tests: backend 94 passing at 95.19% statements / 90.15% branches; frontend 59 passing at 99.40% statements / 90.30% branches
- decisions/notes: Root coverage previously included frontend/generated files; Phase 0 now measures backend service code directly. Full verifier passed, including Docker build and 2 Playwright e2e tests.
- blockers (if any): none

## [21:53] Phase 1 - API authentication  (DONE)
- branch: feat/phase1-api-auth   commit: dcc1849
- what changed:
  - Hardened token auth to fail closed for all non-public API requests and attach a principal for later tenant isolation.
  - Added body-size and rate-limit enforcement, CLI token wiring, Compose token configuration, and env examples.
  - Switched the console API client to `Authorization: Bearer` and documented auth setup in README and docs.
  - Added auth, rate-limit, body-limit, OpenAPI, and web client coverage.
- tests: backend 110 passing at 95.38% statements / 90.81% branches; frontend 59 passing at 99.40% statements / 90.27% branches; full verifier passed including 2 Playwright e2e tests and Docker build
- decisions/notes: Docker Compose requires `LEDGERFLOW_API_TOKEN`; CI and the local verifier inject a disposable token for build validation.
- blockers (if any): none

## [22:20] Phase 2 - Storage abstraction and Postgres  (DONE)
- branch: feat/phase2-storage-postgres   commit: c5fbc20
- what changed:
  - Added aggregate memory/SQLite repositories and routed the API through a single ledger repository facade.
  - Added reversible SQL migrations, a Postgres repository adapter, and pg-mem contract coverage.
  - Added runtime `LEDGERFLOW_DB_URL` selection, startup migration/seed preparation, and build-time migration asset copying.
  - Kept SQLite as the local default and Docker Compose with a Postgres service and healthcheck.
- tests: backend 122 passing at 93.44% statements / 90.79% branches; frontend 59 passing at 99.40% statements / 90.27% branches; full verifier passed including 2 Playwright e2e tests and Docker build
- decisions/notes: pg-mem does not model Pool rollback semantics fully, so transaction rollback coverage asserts LedgerFlow's `BEGIN`/`ROLLBACK`/release choreography directly while the adapter contract covers persistence behavior.
- blockers (if any): none

## [22:31] Phase 3 - Tenants and data isolation  (DONE)
- branch: feat/phase3-tenants-isolation   commit: 11ca69a
- what changed:
  - Added multi-token principal resolution with tenant ids and request-scoped repositories.
  - Added tenant/user/membership migrations plus tenant ownership columns and indexes.
  - Enforced tenant scoping for plans, coupons, usage, customers, subscriptions, and saved simulations through `scopeRepository`.
  - Added endpoint and repository tests proving private plans/coupons/simulations are hidden across tenants.
- tests: backend 127 passing at 93.88% statements / 91.91% branches with scoped repository coverage at 100%; frontend 59 passing at 99.40% statements / 90.27% branches; full verifier passed including 2 Playwright e2e tests and Docker build
- decisions/notes: The repository wrapper keeps memory, SQLite, and Postgres on the same isolation contract while the Phase 3 migration adds tenant-owned schema shape for hosted Postgres.
- blockers (if any): none

## [22:43] Phase 4 - Roles and permissions  (DONE)
- branch: feat/phase4-rbac   commit: 6266a14
- what changed:
  - Added viewer/editor/admin principals, token role mapping, and Fastify RBAC enforcement.
  - Added stable 403 envelopes for forbidden writes and admin-only membership routes.
  - Added tenant-local membership management for admins and updated OpenAPI/docs.
  - Added console role detection so viewer mode hides plan write controls.
- tests: backend 128 passing at 93.96% statements / 91.56% branches; frontend 60 passing at 99.41% statements / 90.51% branches; full verifier passed including 2 Playwright e2e tests and Docker build
- decisions/notes: Single-token deployments remain admin on the default tenant; multi-token deployments can specify `token:tenantId:subject:role`.
- blockers (if any): none

## [22:55] Phase 5 - API hardening  (DONE)
- branch: feat/phase5-api-hardening   commit: 41a6577
- what changed:
  - Added request-id propagation across successful responses and every API error envelope.
  - Mounted the API under `/v1` while keeping legacy root routes available for existing clients.
  - Added `/v1` cursor pagination envelopes for list endpoints with validated `limit` and `cursor` query parameters.
  - Added `Idempotency-Key` replay protection for plan and saved simulation writes.
- tests: backend 134 passing at 93.95% statements / 91.22% branches; frontend 60 passing at 99.41% statements / 90.48% branches; full verifier passed including 2 Playwright e2e tests and Docker build
- decisions/notes: Legacy root list routes still return arrays for backward compatibility; new integrations should use `/v1` and its page envelopes.
- blockers (if any): none

## [23:02] Phase 6 - Billing regression gate product  (DONE)
- branch: feat/phase6-billing-regression-gate   commit: 57d7017
- what changed:
  - Added `ledgerflow assert --context X --expected Y` with exact invoice comparison and a readable field-level drift report.
  - Added direct and process-level tests for golden matches, mismatches, and exit-code contract behavior.
  - Added a composite GitHub Action wrapper plus an example pull-request workflow.
  - Documented adoption steps and the 0/1 exit-code contract in `docs/ci-integration.md`.
- tests: backend 138 passing at 93.95% statements / 91.23% branches; frontend 60 passing at 99.41% statements / 90.48% branches; full verifier passed including 2 Playwright e2e tests and Docker build
- decisions/notes: The Action builds the local package before running the assertion so consumers get the same compiled CLI path used in release images.
- blockers (if any): none

## [23:25] Phase 7 - Observability and operations  (DONE)
- branch: feat/phase7-observability-ops   commit: e0c10f7
- what changed:
  - Added `/ready` repository readiness checks and authenticated Prometheus metrics for request, simulation, duration, and error counters.
  - Added opt-in structured JSON request logs with request id, tenant, subject, route, status, and latency fields.
  - Wrapped tenant repository access and simulation execution in OpenTelemetry spans.
  - Documented readiness, metrics, log fields, tracing, and dashboard queries in `docs/observability.md`.
- tests: backend 140 passing at 94.20% statements / 91.08% branches; frontend 67 passing at 97.82% statements / 90.16% branches; full verifier passed including 2 Playwright e2e tests and Docker build
- decisions/notes: Upgraded Fastify, Vite, Vitest, React Router, and related plugins to clear root and web dependency audits; `LEDGERFLOW_LOGS=1` enables stdout JSON logs.
- blockers (if any): none

## [22:46] Phase 8 - Console scale-up  (WIP)
- branch: feat/phase8-console-scale-up   commit: 01f17eb
- what changed:
  - Added runtime login, persisted tenant sessions, tenant switching, and role-aware route guards.
  - Added `/coupons` and `/v1/coupons` list routes so the console can show a real coupon catalog.
  - Upgraded catalog and simulation library screens to use `/v1` pagination and detail loading.
  - Added save-to-library from the simulator and extended Playwright login-to-save coverage.
- tests: backend 140 passing; frontend 95 passing at 97.60% statements / 91.24% branches; `verify.ps1 -SkipDocker` passed including scan, smoke, build, and 2 Playwright e2e tests
- decisions/notes: Full verifier is blocked only at Docker build because Docker Desktop service is stopped and the Docker engine pipe is unavailable from this session.
- blockers (if any): Start Docker Desktop or the `com.docker.service`, then rerun `.\scripts\verify.ps1` without `-SkipDocker`.

## [23:07] Phase 9 - Performance and scale testing  (BLOCKED)
- branch: feat/phase9-performance-scale   commit: c04c6b7
- what changed:
  - Added an API-side in-memory simulation cache keyed by a SHA-256 hash of the billing context plus resolved plan and coupon records.
  - Added tenant-scoped performance indexes for catalog, usage, customer, and simulation-library lookups.
  - Added a dependency-free live load profile script and documented cache, index, load, and latency budget behavior.
  - Added performance, pagination-limit, cache-clone, branch-edge, and route-helper coverage to keep the backend above 90% branches.
- tests: backend 152 passing at 96.63% statements / 90.11% branches; frontend 95 passing at 97.60% statements / 91.24% branches; `verify.ps1 -SkipDocker` passed including scan, smoke, build, and 2 Playwright e2e tests
- decisions/notes: The cache stays outside the pure billing engine, so deterministic simulation math remains isolated from I/O and process configuration. Full verifier was rerun after the commit and failed only at Docker build.
- blockers (if any): Docker Desktop engine is unavailable from this session; `docker compose build` cannot connect to `//./pipe/dockerDesktopLinuxEngine`.

## [23:12] Phase 9 - Docker verification retry  (BLOCKED)
- branch: feat/phase9-performance-scale   commit: b016d72
- what changed:
  - Rechecked Docker availability after resuming the goal.
  - Confirmed the Docker service is still stopped and the engine pipe is still unavailable.
- tests: no code change; previous green state remains backend 152 passing at 96.63% statements / 90.11% branches and frontend 95 passing at 97.60% statements / 91.24% branches
- decisions/notes: Phase 10 was not started because Phase 9's Docker-backed verification is still not green and Phase 10's release DoD depends on a secured Docker/compose bring-up.
- blockers (if any): Windows refuses `Start-Service com.docker.service` with "Cannot open com.docker.service service on computer '.'"; start Docker Desktop manually or grant service access, then rerun `.\scripts\verify.ps1`.

## [00:07] Phase 9 - Docker verification complete  (DONE)
- branch: feat/phase9-performance-scale   commit: fa0dd6f
- what changed:
  - Re-ran the complete verifier after Docker Desktop became reachable via the `desktop-linux` context.
  - Confirmed the Docker image builds successfully after backend, frontend, scan, smoke, and E2E gates.
- tests: backend 152 passing at 96.63% statements / 90.11% branches; frontend 95 passing at 97.60% statements / 91.24% branches; 2 Playwright e2e passing; Docker build passing
- decisions/notes: An initial full-verifier run hit a Playwright page-start timeout; the direct E2E rerun passed, and the next full verifier passed end to end.
- blockers (if any): none

## [00:19] Phase 10 - Release, deploy and docs  (DONE)
- branch: feat/phase10-release-readiness   commit: b705730
- what changed:
  - Added `docker-compose.prod.yml` with required API token configuration, private Postgres, read-only app runtime, and production health checks.
  - Added `scripts/verify-release.ps1` to build, boot, verify auth/readiness/catalog behavior, and tear down the production compose stack.
  - Added `docs/production-runbook.md`, `docs/threat-model.md`, release checklist updates, operations docs, README release commands, and a 0.2.0 changelog entry.
  - Bumped release surfaces to 0.2.0 and added backend/frontend tests for release artifacts and console release links.
- tests: backend 160 passing; frontend 99 passing at 97.61% statements / 91.24% branches; `.\scripts\verify.ps1` passed including scan, smoke, 2 Playwright e2e tests, and Docker build; `.\scripts\verify-release.ps1` passed against production compose
- decisions/notes: Production compose uses Postgres via `LEDGERFLOW_DB_URL`, so API startup applies migrations before serving traffic. The local release tag is `v0.2.0`.
- blockers (if any): none
