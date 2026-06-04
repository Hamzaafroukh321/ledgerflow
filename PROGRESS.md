# PROGRESS

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
