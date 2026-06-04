# PROGRESS

## [21:07] Phase 0 — Baseline lock, safety nets & dependency refresh  (WIP)
- branch: feat/phase0-baseline   commit: pending
- what changed:
  - Copied the scaling playbook into the repo and committed it.
  - Scoped backend coverage to backend source files and raised the gate to 90/90/90/90.
  - Added deterministic invoice golden fixtures, an OpenAPI snapshot, and property/invariant coverage.
  - Added focused backend branch coverage locks for pure helper modules.
- tests: backend 94 passing; coverage: 95.19% statements / 90.13% branches; frontend pending
- decisions/notes: Root coverage previously included frontend/generated files; Phase 0 now measures backend service code directly.
- blockers (if any): Docker engine is unavailable locally, so full verifier still cannot complete Docker build.
