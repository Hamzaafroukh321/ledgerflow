# ledgerflow — Scaling Prompt & Engineering Playbook

> **What this file is.** A long-form, self-contained prompt + playbook for taking
> ledgerflow from a solid deterministic billing-simulation MVP to a serious, hostable
> billing-rules product. Paste any **Phase** block into a fresh Claude Code session opened
> at this repo and work it top to bottom. Every phase is scoped, testable, and ends with a
> hard Definition of Done. The **non-negotiable global rule**: **test coverage must be ≥
> 90% (statements AND branches)** for both the server core and the web console, enforced in
> CI, and never lowered to make a build pass.

---

## 0. How to use this document

- Organized into **Phases (0–10)**, ordered by dependency. Do them in order.
- Each phase: **Goal · Why now · Scope (in/out) · Files & modules · Step-by-step tasks ·
  Tests to add · Commands · Definition of Done.**
- Do not start a phase until the previous phase's DoD is fully green.
- Work on a feature branch per phase (`feat/phaseN-<slug>`); keep PRs small and green.
- **Do not** rename the product, the CLI binary (`ledgerflow`), or the npm package.
- **Do not** create a branch named `original`; do not rewrite history or touch `.git`.
- **Do not** reference the local parent directory name anywhere in code, docs, commits, or
  comments. The product name is `ledgerflow`; that is the only name that ships.

---

## 1. Verified starting point (audited 2026-06-04)

**Product.** A **deterministic billing rules engine + invoice simulation toolkit** for
SaaS teams. It turns a billing context into a fully explained invoice (pricing, proration,
discounts, credits, coupons, refunds) **without moving money or contacting payment
processors**. That "no money movement" boundary is intentional and is part of the product
identity.

**Stack (as it exists today):**

| Layer | Technology | Location |
|---|---|---|
| Core | TypeScript (ESM), Node ≥ 20 | `src/**/*.ts` (~107 modules) |
| API | Fastify 4 + `@fastify/swagger` (`/docs`, `/openapi.json`) | `src/` (serve command) |
| Validation | zod 3 | throughout |
| Time | luxon | core |
| Persistence | better-sqlite3 (SQLite) | core/storage |
| CLI | commander (`ledgerflow`) | `src/cli/index.ts` |
| Frontend | React + Vite + TS console | `web/src/**` (API client, MSW tests) |
| Packaging | Dockerfile (single-process serves web+API), compose | `Dockerfile`, `docker-compose.yml` |
| Tooling | vitest + v8 coverage, eslint 8, prettier | `vitest.config.ts` |
| Windows verify | `scripts/verify.ps1`, `scripts/count_tests.ps1` | scripts |

**Verified current test state:** core **75 vitest passing** (17 files, incl. a 15-test API
integration suite); web **51 vitest passing** (20 files). `npm run build` (tsc) clean.

**Known maintenance drift:** eslint 8 and zod 3 lag the latest majors (deploy-radar, a
sibling, is on eslint 9 / zod 4). Phase 0 plans a dependency refresh.

**The structural gap:** no authentication and no multi-tenant data model. Everything else
is maturity/scale work.

---

## 2. Target product (where scaling takes us)

ledgerflow becomes a **hosted billing-rules-and-simulation service** for SaaS finance/eng:

- Authenticated, multi-tenant API with persisted plans, coupons, and saved simulations.
- A durable datastore (Postgres) behind the existing SQLite-shaped data layer, with
  migrations.
- A polished console with auth, tenant switching, a plan/coupon catalog, a saved-simulation
  library, and an invoice explanation viewer.
- A packaged **CI/script gate** so teams can assert "this billing change produces the
  expected invoice" in tests (a regression gate for pricing logic).
- Observability + a real deploy story.
- **90%+ coverage maintained throughout.**

What we deliberately do **not** build: real money movement / payment processor integration
(that crosses the product's defining boundary), a general-purpose accounting ledger, or an
IdP. ledgerflow *simulates and explains*; it does not charge cards.

---

## 3. Non-negotiable guardrails (apply to every phase)

1. **Coverage ≥ 90% (statements and branches), enforced in CI.** Never lower the gate.
2. **Determinism is the product.** Identical billing context ⇒ byte-identical invoice +
   trace. This is the single most important invariant — protect it with goldens.
3. **No money movement.** Do not add real payment-processor calls; the simulation boundary
   is intentional.
4. **Validation at every boundary** with zod; never trust raw input.
5. **No secrets in the repo.** Config via env; `.env.example` documents every var.
6. **Small, reversible PRs.** One phase = one or more green PRs.
7. **Docs travel with code:** every endpoint, CLI command, env var documented in `docs/`.
8. **No local-folder-name leakage** in any shipped artifact.

---

## 4. Coverage strategy (the 90%+ mandate, in detail)

Applies to **every** phase. "Never below 90%," not "90% once."

**Server core (vitest + v8):**
- Configure thresholds in `vitest.config.ts`: `coverage: { provider: 'v8', thresholds: {
  statements: 90, branches: 90, functions: 90, lines: 90 } }`.
- Mirror `src/` with `test/`; new module ⇒ new spec in the same PR.
- **Golden invoice fixtures:** `test/golden/` holds billing contexts and the expected
  invoice JSON (with trace); any pricing/discount/refund change updates goldens on purpose.
- **Property tests** (fast-check): an invoice total equals the sum of its line items minus
  discounts plus taxes (the accounting identity); proration never produces negative
  charges; applying then reversing a credit returns the original total.
- Keep the Fastify API integration suite (`inject`) hitting every route.

**Web console (vitest + v8):**
- Same 90/90/90/90 thresholds in `web/vitest.config.ts`.
- Test every component, hook, and the API client; keep the MSW handlers realistic.

**Cross-cutting:**
- **Contract test:** generate `/openapi.json`, snapshot, assert the web client types match;
  fail on undocumented drift.
- **E2E smoke** (Playwright): load console → pick plan → run simulation → see explained
  invoice. Small but real.
- CI hard-fails on red, sub-90% coverage, or contract drift.

---

## 5. Target architecture (current → scaled)

```
   CI / test gate ─▶ ledgerflow CLI (simulate → invoice JSON / exit code)
                                   │ (same core)
   React Console ─┐               ▼
                  │     ┌───────────────────────────────┐
   API callers ───┼───▶ │ Fastify API (authenticated)   │
                  │     │  - auth (token/JWT)           │
                  │     │  - tenant scoping middleware  │
                  │     │  - simulate/plans/coupons/... │
                  │     │  - saved simulations library  │
                  │     └──────────────┬────────────────┘
                                       │
                     ┌─────────────────┴────────────────┐
                     │ Data layer (repository interface) │
                     │ SQLite (dev) → PostgreSQL (prod)  │
                     │ migrations · per-tenant rows      │
                     └───────────────────────────────────┘
```

Moves: put a **repository interface** in front of better-sqlite3 so Postgres is swappable;
thread a **tenant/identity** through every request; keep the **pure billing core** free of
I/O (it already is — protect that boundary).

---

## 6. PHASE 0 — Baseline lock, safety nets & dependency refresh

**Goal.** Freeze a verified baseline + coverage/CI machinery, and bring dependencies
current (eslint 9, zod 4) without changing billing behavior.

**Why now.** A deterministic billing engine must not regress silently; the dep refresh is
cheapest before new code lands.

**Scope.** In: reproducible setup, branch-coverage thresholds, golden invoice fixtures, CI,
OpenAPI snapshot, baseline latency, eslint/zod major bumps. Out: any billing-behavior change.

**Files & modules.** `vitest.config.ts`, `web/vitest.config.ts`, `test/golden/` (new),
`.github/workflows/ci.yml` (new/extend), `docs/testing.md` (new), `package.json` (dep bumps),
`scripts/bench.ts` (new).

**Step-by-step tasks.**
1. Fresh `npm ci`; run core + web suites; record counts + coverage in `docs/testing.md`.
2. Turn on branch coverage thresholds (90×4) for core and web; fix any module under 90%
   branches by adding specs (not by excluding code).
3. Build `test/golden/`: snapshot `simulate` output for every `examples/*` context; add a
   spec that re-runs and asserts byte-stable equality (sorted keys, trace included).
4. Snapshot `/openapi.json`; add a spec that regenerates and diffs it.
5. Bump eslint 8→9 and zod 3→4; fix the resulting lint/type changes; re-run all goldens to
   prove **billing output is byte-identical** after the bump.
6. Stand up CI: Node 20/22 matrix; install, lint, typecheck, core test+coverage, web
   test+coverage, build, Docker build; upload coverage.
7. Record baseline latency for `simulate` on the largest example via `scripts/bench.ts`.

**Tests to add.**
- `test/golden/invoice.golden.test.ts` — every example, byte-stable.
- `test/openapi.contract.test.ts` — regenerate + diff spec.
- `test/property/invoice.invariants.test.ts` — fast-check identities above.

**Commands.**
```powershell
npm ci ; npm test ; npm run coverage ; npm run build
cd web ; npm ci ; npm test ; npm run build ; cd ..
.\scripts\verify.ps1
```

**Definition of Done.**
- [ ] Core + web suites green; coverage ≥ 90% statements AND branches.
- [ ] Golden + OpenAPI contract specs committed and passing.
- [ ] eslint 9 / zod 4 in place; goldens prove byte-identical invoices post-bump.
- [ ] CI blocks merges on red or sub-90% coverage; baseline latency recorded.

---

## 7. PHASE 1 — API authentication (the blocker)

**Goal.** No route except `/health` (and optionally `/openapi.json`, `/docs`) is reachable
without a valid credential when a token is configured; local dev and the existing 75+51
tests keep working via an explicit, warned open mode.

**Why now.** Hosting a billing API unauthenticated is unacceptable; auth gates every later
multi-tenant phase.

**Scope.** In: bearer-token Fastify auth hook, CLI/serve wiring, console wiring, env docs,
body-size + rate limits, auth tests. Out: full accounts, OAuth/OIDC, RBAC (Phase 4).

**Files & modules.** `src/server/auth.ts` (new); the Fastify serve setup (register an
`onRequest` hook); `src/cli/index.ts` — `--api-token` / env `LEDGERFLOW_API_TOKEN`;
`web/src/lib/apiClient.ts` (or equivalent) — bearer header; `web/.env.example`;
`docker-compose.yml`; `docs/auth.md` (new), README auth section.

**Step-by-step tasks.**
1. Implement `verifyToken` reading `LEDGERFLOW_API_TOKEN`. Unset ⇒ open mode + one loud
   startup warning. Set ⇒ require `Bearer` or 401; constant-time compare.
2. Build a `Principal { subject, tenantId, role }` for later phases.
3. Register a Fastify `onRequest` hook that allows `/health` and rejects everything else
   without a valid token (fail closed).
4. Add `@fastify/rate-limit` and a body-size limit on simulate/library routes.
5. Thread the token through CLI `serve` and `docker-compose.yml`.
6. Update the web client to send the header; surface a clear 401 UI state.
7. Document every env var + the open-mode warning.

**Tests to add.**
- `test/server/auth.test.ts`: `/health` open; every other route → 401 without token
  (parametrized); expected status with token; open mode works + warns.
- Web client test: header attached; 401 → typed error + UI.

**Definition of Done.**
- [ ] All non-health routes reject unauthenticated requests when a token is set.
- [ ] Open mode works, warns, keeps existing tests green.
- [ ] Console authenticates end-to-end; `.env.example` updated.
- [ ] Body-size + rate limiting in place; coverage ≥ 90%; auth code ≥ 95%.

---

## 8. PHASE 2 — Storage abstraction & PostgreSQL

**Goal.** Put a repository interface in front of better-sqlite3 and add a PostgreSQL backend
with migrations; keep SQLite for dev/tests.

**Why now.** Multi-tenant durability + concurrency need a real DB; the interface must exist
before tenant scoping (Phase 3).

**Scope.** In: repository ports, SQLite + Postgres adapters, migration tool, pooling,
transactions. Out: tenant columns (Phase 3), analytics (Phase 7).

**Files & modules.** `src/data/repository.ts` (new), `src/data/sqlite.ts` (refactor),
`src/data/postgres.ts` (new), `src/data/migrations/` (new), serve selects backend by env
`LEDGERFLOW_DB_URL`, `docs/data-model.md` (new).

**Tasks.** Extract storage ops into a `Repository` interface (save plan, list plans, save
coupon, list coupons, save simulation, list simulations, get simulation); make SQLite
implement it unchanged; implement Postgres + a baseline migration; run `migrate up` on
startup/CI/Docker; select backend by env; add a Postgres service + healthcheck to compose.

**Tests.** One repository contract suite on SQLite + Postgres; migration up/down round-trip;
concurrency test on the saved-simulation library.

**Definition of Done.**
- [ ] API depends only on `Repository`, not better-sqlite3 directly.
- [ ] Same contract suite passes on both backends; migrations reverse cleanly; coverage ≥ 90%.

---

## 9. PHASE 3 — Tenants & data isolation

**Goal.** Every plan, coupon, and saved simulation belongs to a tenant; a principal only
sees/modifies its own tenant's data.

**Scope.** In: tenant + user model, principal→tenant resolution, row-level scoping on every
query, cross-tenant denial (404), library attribution. Out: signup, billing-of-the-product,
SSO.

**Files & modules.** `src/data/repository.ts` (scoped methods), both adapters,
`src/server/auth.ts` (principal carries `tenantId`), migrations, `docs/multitenancy.md`.

**Tasks.** Add `tenants`, `users`, `memberships` + migrations; add `tenant_id` to every
record with a backfill; resolve token→principal→tenant; push scoping into the repository;
other tenants' resources return 404; attribute saved simulations to tenant + principal.

**Tests.** Cross-tenant matrix (A cannot read/list/update/delete B's plans/coupons/simulations
→ 404); backfill migration on seeded legacy rows; repository contract suite extended with
scoping on both DBs.

**Definition of Done.**
- [ ] No endpoint returns another tenant's data under any input.
- [ ] Scoping verified on both DBs; coverage ≥ 90%; scoping code ≥ 95%.

---

## 10. PHASE 4 — Roles & permissions

**Goal.** Roles (viewer, editor, admin) gate console/API actions (only editor+ can create
plans/coupons or save to the shared library).

**Files.** `src/server/rbac.ts` (new), Fastify hooks, console route guards.

**Tasks.** Map endpoints→required permissions; enforce after auth; deny ⇒ 403 with a clear
envelope; hide UI affordances for `viewer`.

**Tests.** Per-role access matrix; viewer cannot mutate; admin manages memberships.

**Definition of Done.** Role matrix fully tested; coverage ≥ 90%.

---

## 11. PHASE 5 — API hardening & versioning

**Goal.** `/v1` namespace, zod validation on every route, uniform error envelope, pagination
on list endpoints, idempotency on saves, rate limits, request IDs.

**Tasks.** Add `/v1` routes; zod schemas on bodies/queries; standardize error bodies +
document in OpenAPI; cursor pagination; `Idempotency-Key` for plan/coupon/simulation creation;
request-id propagation.

**Tests.** Validation rejects malformed input with the standard envelope; pagination cursors
stable + correct totals; idempotency replay returns the original; 429 on rate limit; request
id everywhere.

**Definition of Done.** Every endpoint typed + documented; `/v1` live; OpenAPI + contract
test updated; coverage ≥ 90%.

---

## 12. PHASE 6 — Billing-regression gate product

**Goal.** Ship the adoption driver tailored to this product: a **billing regression gate**
that asserts "this billing context produces this exact invoice," so teams can guard pricing
logic in their own CI. (Unlike deploy-radar/schema-sentinel, the natural artifact is a
golden-invoice harness, not a SARIF security finding.)

**Scope (in).** A CLI mode (`ledgerflow assert --context X --expected Y`) and a thin GitHub
Action wrapping it; a documented exit-code contract (0 match / 1 drift); a readable diff of
expected vs actual invoice; example workflows. Out: other CI providers (later).

**Files.** `src/cli/assert.ts` (new), `action.yml` (new), `docs/ci-integration.md`,
`examples/ci/github-workflow.yml`.

**Tasks.** Implement `assert` that simulates a context and diffs against an expected invoice;
non-zero exit on drift with a human-readable diff; wrap in an Action.

**Tests.** Golden match/mismatch cases; exit-code contract tests; diff formatting test;
workflow lints.

**Definition of Done.** A repo can adopt the gate and block merges on unintended billing
drift; exit codes documented + tested; coverage ≥ 90%.

---

## 13. PHASE 7 — Observability & operations

**Goal.** Structured logs (pino), Prometheus `/metrics`, OpenTelemetry traces, liveness
`/health` + readiness `/ready`, sample dashboard.

**Scope (in).** JSON logs with request id + principal/tenant; metrics (request counts,
latency, simulation count, error rate); OTel spans around simulate + DB; `/ready` fails when
DB unreachable while `/health` stays up.

**Tests.** Metrics endpoint exposes expected series; failing DB makes `/ready` fail; log
lines valid JSON with required fields.

**Definition of Done.** Logs, metrics, traces, liveness/readiness present and tested;
coverage ≥ 90%.

---

## 14. PHASE 8 — Console scale-up

**Goal.** A real multi-tenant product UI: auth flow, tenant switcher, role-gated views, a
plan/coupon catalog, a saved-simulation library, and an invoice explanation viewer bound to
the real API.

**Scope (in).** Login + token handling; tenant context; route guards by role; list/detail
for plans/coupons/simulations with pagination; invoice + trace visualization; accessible,
responsive layout.

**Tests (frontend coverage ≥ 90%).** Component tests for every new view; hook tests with
MSW; E2E Playwright: login → pick plan → run simulation → view explained invoice → save to
library.

**Definition of Done.** Console usable by a multi-tenant org with roles; frontend coverage
≥ 90% incl. branches; E2E smoke green.

---

## 15. PHASE 9 — Performance & scale testing

**Goal.** Prove the system holds under load and complex billing contexts.

**Scope (in).** Benchmarks for simulate on large/complex contexts (many line items,
stacked coupons); DB indexes for scoped list queries; a k6/autocannon load profile; cache
simulation results keyed by content hash of the context; pagination limits enforced.

**Tests.** Regression benchmark asserts no >X% latency regression vs Phase 0; load test
sustains target RPS; cache hit path covered.

**Definition of Done.** Performance budget met; indexes + cache in place and tested;
coverage ≥ 90%.

---

## 16. PHASE 10 — Release, deploy & docs

**Goal.** A real production deployment with auth ON, migrations applied, secrets injected,
versioned releases, runbook + threat model.

**Scope (in).** Production Docker/compose profile with auth required (the single-process
image already serves web + API); `migrate up` on deploy; secret injection; semver + changelog;
"deploy from scratch" runbook; threat model.

**Definition of Done.** One documented command path brings up a secured, migrated instance;
CHANGELOG + tag; runbook + threat model in `docs/`; coverage ≥ 90% core and web.

---

## 17. Feature backlog — useful vs. avoid

**Build (high value):**
- API auth + multi-tenant (Phases 1–4).
- Billing-regression gate (Phase 6) — the adoption driver for this product.
- Plan/coupon catalog + saved-simulation library + invoice viewer (Phase 8).
- Simulation caching (Phase 9).
- Dependency currency (Phase 0) — keep eslint/zod aligned with the sibling repos.

**Avoid (scope traps):**
- **Real payment-processor integration / money movement** — this crosses the product's
  defining boundary. ledgerflow simulates; it does not charge.
- A general-purpose double-entry accounting ledger — out of scope.
- A bespoke IdP — integrate, don't build.
- New pricing primitives with no requester — only add what a real team asks for, behind
  goldens.
- A visual rules builder / DSL editor — premature.

---

## 18. Definition of Done (global)

- [ ] API requires auth on all non-health routes; open mode explicit + warned.
- [ ] Per-tenant isolation enforced at the repository layer, tested on SQLite + Postgres.
- [ ] Roles gate actions.
- [ ] `/v1` API: zod validation, uniform errors, pagination, idempotency, rate limits.
- [ ] Billing-regression gate ships; exit-code contract documented and tested.
- [ ] Observability: logs, metrics, traces, liveness/readiness.
- [ ] Console: multi-tenant, roles, catalog, library, invoice viewer.
- [ ] Performance budget met; caching + indexes in place.
- [ ] Production deploy with migrations + secrets; runbook + threat model written.
- [ ] **Coverage ≥ 90% (statements AND branches), core and web, enforced in CI, always.**
- [ ] No money movement introduced; simulation boundary intact.
- [ ] No local-folder-name references anywhere; product name `ledgerflow` only.

---

## 19. Command reference

```powershell
# Core
npm ci ; npm test ; npm run coverage ; npm run build
node dist/cli/index.js simulate --input examples/invoice-basic.json --pretty --trace
node dist/cli/index.js serve --api-token $env:LEDGERFLOW_API_TOKEN --port 3000

# Migrations (after Phase 2)
npm run migrate:up ; npm run migrate:down

# Web
cd web ; npm ci ; npm test ; npm run build ; cd ..

# Full stack (single-process image serves web + API)
docker compose up --build

# Windows verifier
.\scripts\verify.ps1 ; .\scripts\count_tests.ps1
```

---

## 20. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Auth change breaks existing 75+51 tests | High | Open-mode default + parametrized auth tests. |
| Billing determinism drift during refactor / dep bump | Critical | Golden invoices gate every PR; bump proven byte-identical. |
| Tenant isolation bug leaks billing data | Critical | Scoping at repository layer only; cross-tenant matrix on both DBs. |
| Someone adds real money movement | High | "Avoid" list is binding; review rejects payment-processor calls. |
| SQLite/Postgres divergence | Medium | One contract suite on both. |
| Coverage erosion | Medium | CI hard-fails < 90%; no blanket excludes. |

---

## 21. Concrete code skeletons (starting points)

### 21.1 Fastify auth hook (`src/server/auth.ts`)

```ts
import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";

export interface Principal { subject: string; tenantId: string; role: string; }

const configuredToken = () => (process.env.LEDGERFLOW_API_TOKEN ?? "").trim() || null;
let warned = false;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function registerAuth(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    if (req.url === "/health") return;
    const token = configuredToken();
    if (!token) {
      if (!warned) { app.log.warn("LEDGERFLOW_API_TOKEN unset: OPEN MODE, no auth"); warned = true; }
      (req as any).principal = { subject: "local", tenantId: "local", role: "admin" };
      return;
    }
    const header = req.headers.authorization ?? "";
    if (!header.startsWith("Bearer ") || !safeEqual(header.slice(7).trim(), token)) {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "invalid token" } });
    }
    (req as any).principal = { subject: "token", tenantId: "default", role: "admin" };
  });
}
```

### 21.2 Repository interface (`src/data/repository.ts`)

```ts
export interface Repository {
  savePlan(tenantId: string, plan: unknown): Promise<{ id: string }>;
  listPlans(tenantId: string, opts: { cursor?: string; limit: number }): Promise<Page<PlanRow>>;
  saveCoupon(tenantId: string, coupon: unknown): Promise<{ id: string }>;
  listCoupons(tenantId: string): Promise<CouponRow[]>;
  saveSimulation(tenantId: string, sim: unknown): Promise<{ id: string }>;
  getSimulation(tenantId: string, id: string): Promise<SimulationRow | null>;
  listSimulations(tenantId: string, opts: { cursor?: string; limit: number }): Promise<Page<SimulationRow>>;
}
export interface Page<T> { items: T[]; nextCursor: string | null; total: number; }
```

### 21.3 Determinism + scoping invariants

> **Determinism:** the billing core must be a pure function of its input context. No
> `Date.now()`, no randomness, no environment reads inside pricing logic — clock/time is an
> explicit input (it already is, via luxon-based context). Golden invoices enforce this.
>
> **Scoping (Phase 3):** every read filters `WHERE tenant_id = :tenant`; every write sets
> `tenant_id = principal.tenantId`. Cross-tenant access returns **404**. The rule lives only
> in the repository layer.

---

## 22. Endpoint catalog (target `/v1` shape)

- `POST /v1/simulate` — `{ context }` → fully explained invoice + trace.
- `POST /v1/validate-coupon` — `{ code, context }` → coupon validity + effect.
- `POST /v1/refund` — `{ invoice, amount, strategy }` → refund breakdown (simulation only).
- `GET  /v1/plans` / `POST /v1/plans` — plan catalog (tenant-scoped, editor+ to create).
- `GET  /v1/coupons` / `POST /v1/coupons` — coupon catalog (tenant-scoped).
- `GET  /v1/simulations` / `GET /v1/simulations/:id` — saved-simulation library (paginated).
- `POST /v1/assert` — billing-regression gate (or CLI-only; Phase 6).
- `GET  /health` (open) · `GET /ready` · `GET /metrics` · `GET /openapi.json` · `GET /docs`.

Standard pagination envelope `{ items, nextCursor, total }`; standard error envelope
`{ error: { code, message, details[], requestId } }`.

---

## 23. Exhaustive test-case checklist

**Billing core (≥ 95%):**
- [ ] Flat plan → correct base charge.
- [ ] Usage/tiered pricing → correct per-tier totals.
- [ ] Proration on mid-cycle change → correct partial charge, never negative.
- [ ] Single discount applied correctly.
- [ ] Stacked coupons applied in the correct, deterministic order.
- [ ] Credits reduce the total; applying then reversing returns the original total.
- [ ] Partial refund (proportional + other strategies) → correct breakdown.
- [ ] Invoice total = Σ line items − discounts + taxes (property identity).
- [ ] Trace explains every line and adjustment.
- [ ] Identical context → byte-identical invoice + trace (golden).
- [ ] Invalid context → typed zod error, not a crash.

**Auth (Phase 1, ≥ 95%):**
- [ ] `/health` open; every other route 401 without token (parametrized).
- [ ] Valid token → expected; wrong scheme → 401; tampered → 401; open mode warns once.

**Tenancy (Phase 3, ≥ 95%):**
- [ ] A cannot read/list/update/delete B's plans/coupons/simulations (each → 404).
- [ ] Writes stamp caller's tenant; library entries attributed to tenant + principal.

**Repository contract (SQLite AND Postgres):**
- [ ] save→get round-trips; list paginates with stable cursors + correct total.
- [ ] concurrent writers serialize; idempotency replay returns original.

**API hardening (Phase 5):**
- [ ] Malformed input → standard envelope; oversized body → 413; rate limit → 429.
- [ ] requestId present in every response + log.

**Frontend (≥ 90% incl. branches):**
- [ ] API client attaches bearer header; 401 → typed error + UI.
- [ ] Every view: loading/empty/error/data states; invoice + trace render correctly.
- [ ] Tenant switcher changes context + refetches; viewer affordances hidden.
- [ ] E2E: login → pick plan → simulate → view invoice → save to library.

---

## 24. Glossary

- **Context** — the billing inputs (plan, usage, customer, coupons, clock).
- **Invoice** — the computed, explained output.
- **Trace** — the line-by-line reasoning behind the invoice.
- **Proration** — partial charge for a mid-cycle change.
- **Coupon stacking** — applying multiple coupons in a deterministic order.
- **Refund strategy** — how a refund is allocated (e.g. proportional).
- **Principal / Tenant** — authenticated caller and its isolation boundary.

---

## 25. New-engineer onboarding

1. Read this file and the README CLI section.
2. `npm ci`; run core + web suites + coverage; confirm ≥ 90%.
3. `docker compose up --build`; open the console; run a simulation.
4. Make a trivial change; watch CI enforce coverage + golden invoices.
5. Pick the lowest open phase; never start one whose predecessor's DoD is red.

---

## 26. Anti-patterns to reject in review

- Any `Date.now()` / randomness / env read inside the billing core (breaks determinism).
- Hand-rolled `tenant_id` checks inside route handlers (must live in the repository).
- New endpoints without zod schemas or OpenAPI documentation.
- Lowering a coverage threshold or blanket coverage excludes.
- **Adding real payment-processor calls / money movement.**
- Adding pricing primitives without a golden + a requesting user.
- Committing the local parent-directory name into any artifact.

---

## 27. FAQ

**Q: Can we host before Phase 1?** No — auth first.
**Q: Should ledgerflow charge cards?** No. It simulates and explains; money movement is out
of scope by design. Integrate with a real biller downstream if needed, but ledgerflow stays
a deterministic engine.
**Q: SQLite or Postgres for tests?** SQLite for speed; the contract suite also runs on
Postgres in CI.
**Q: What if a phase can't reach 90%?** Refactor for testability; don't lower the gate.

---

## 28. Suggested delivery timeline

| Window | Phases | Outcome |
|---|---|---|
| Week 1 | 0, 1 | Baseline + CI 90% + dep refresh; API authenticated. |
| Week 2 | 2, 3 | Postgres + migrations; per-tenant isolation on both DBs. |
| Week 3 | 4, 5 | Roles; hardened `/v1` API. |
| Week 4 | 6, 7 | Billing-regression gate; observability. |
| Week 5 | 8 | Console multi-tenant + roles + catalog + library + invoice viewer. |
| Week 6 | 9, 10 | Performance budget; secured, migrated production deploy. |

---

## 29. Metrics to track

- Coverage (core + web statements/branches) — ≥ 90%, never below.
- simulate p50/p95 latency vs Phase 0 baseline.
- simulation volume and refund/credit mix (sanity signal).
- Error rate by endpoint and by tenant.
- Regression-gate adoption: repos using it; merges blocked on unintended billing drift.
- Tenant isolation: zero cross-tenant access in synthetic canaries.

---

## 30. Data-model evolution notes

- First migration reproduces the current SQLite schema exactly (no-op upgrade).
- Phase 3 adds `tenant_id` to every table with a backfill; index `(tenant_id, id)` and
  `(tenant_id, created_at)` for scoped list + pagination.
- Phase 5 adds `idempotency_keys(tenant_id, key, response_hash, created_at)`.
- Keep migrations reversible; CI runs `up` then `down` on PRs touching `migrations/`.

---

## 31. Security checklist (before any public deploy)

- [ ] Auth required on every non-health route; tokens constant-time compared, never logged.
- [ ] Per-tenant isolation at the data layer, canary-tested.
- [ ] zod validation on every endpoint; body size capped.
- [ ] Rate limiting present and documented.
- [ ] Secrets via env/secret manager; `.env.example` complete.
- [ ] `npm audit` clean in CI; no known-high CVEs.
- [ ] Error envelopes never leak stack traces or other tenants' identifiers.
- [ ] No payment-processor credentials anywhere (there is no money movement).
- [ ] Threat model written and reviewed.

---

## 32. Repository map

| Area | Path | Notes |
|---|---|---|
| Billing core | `src/` pricing/discount/refund modules | Pure + deterministic; protect from I/O. |
| CLI | `src/cli/index.ts` | Binary `ledgerflow`; add `serve --api-token`, `assert`. |
| API serve | `src/` serve command | Register auth + `/v1` here. |
| Storage | `src/` storage module | Refactor behind `Repository`. |
| Web client | `web/src/` API client | Add bearer header. |
| Console env | `web/.env.example` | Add token var. |
| Compose | `docker-compose.yml` | Single-process image; auth ON for prod. |
| Verify scripts | `scripts/verify.ps1`, `count_tests.ps1` | Keep green. |
| Docs | `docs/` | Keep endpoints/env documented. |

---

## 33. Phase-by-phase test-count targets

| Phase | New core tests (min) | New web tests (min) | Coverage gate |
|---|---|---|---|
| 0 Baseline | +15 (golden, property, contract) | +5 (thresholds) | ≥ 90 / 90 |
| 1 Auth | +18 | +6 | ≥ 90, auth ≥ 95 |
| 2 Storage/PG | +22 | — | ≥ 90 |
| 3 Tenancy | +28 | +4 | ≥ 90, scoping ≥ 95 |
| 4 Roles | +18 | +8 | ≥ 90 |
| 5 API hardening | +24 | +4 | ≥ 90 |
| 6 Regression gate | +16 | — | ≥ 90 |
| 7 Observability | +12 | — | ≥ 90 |
| 8 Console | +6 | +36 (views, hooks, E2E) | ≥ 90 / 90 |
| 9 Performance | +10 | +4 | ≥ 90 |
| 10 Release | +8 | +4 | ≥ 90 / 90 |

---

## 34. Definition of "bigger project" for ledgerflow

"Bigger" means **all** of:

1. Multiple tenants sign in, each isolated, each with their own plan/coupon catalog and
   saved-simulation library.
2. The API is authenticated, versioned (`/v1`), validated, paginated, rate-limited, and
   observable.
3. Data lives in PostgreSQL with reversible migrations and indexed, tenant-scoped queries.
4. A billing-regression gate lets any repo guard pricing logic in CI.
5. The console offers a catalog, a library, and an invoice/trace viewer.
6. There is a documented, reproducible, secured production deploy with a runbook + threat
   model.
7. **Core and web coverage are ≥ 90% (statements and branches) and CI enforces it.**
8. **No money movement was introduced** — the deterministic-simulation boundary is intact.

---

## 35. What NOT to change (hard list)

- Don't rename the product, the `ledgerflow` CLI, or the npm package.
- Don't create a branch named `original`; don't rewrite history or touch `.git`.
- Don't break determinism — no clocks/randomness/env reads in the billing core.
- Don't add real payment-processor calls or money movement.
- Don't put I/O in the pure billing core.
- Don't lower any coverage threshold to make CI pass.
- Don't reference the local parent directory name in any shipped artifact.

---

## 36. Closing note

ledgerflow's whole value is a **deterministic, explainable** billing engine. Scaling it is
about **auth, multi-tenant durability, a regression gate, and operability — not money
movement and not more pricing primitives.** Hold the 90%+ coverage line, protect
determinism with golden invoices, keep the simulation boundary intact, and ship the auth +
tenancy + gate story. That is what turns a solid MVP into a hostable product.

---

## 37. Expanded request/response examples

### 37.1 `POST /v1/simulate`

Request:
```json
{
  "context": {
    "customer": { "id": "cust_1", "currency": "USD" },
    "plan": { "id": "pro", "basePrice": 4900, "interval": "month" },
    "usage": [ { "metric": "seats", "quantity": 5, "unitPrice": 1000 } ],
    "coupons": ["SAVE20"],
    "clock": "2025-06-15T00:00:00Z",
    "periodStart": "2025-06-01T00:00:00Z",
    "periodEnd": "2025-06-30T23:59:59Z"
  }
}
```
Response (abbreviated, deterministic):
```json
{
  "invoice": {
    "currency": "USD",
    "lines": [
      { "label": "Pro plan (base)", "amount": 4900 },
      { "label": "Seats × 5", "amount": 5000 }
    ],
    "discounts": [ { "code": "SAVE20", "amount": -1980 } ],
    "subtotal": 9900,
    "total": 7920
  },
  "trace": [
    { "step": "base", "detail": "Pro plan base 4900" },
    { "step": "usage", "detail": "5 seats × 1000 = 5000" },
    { "step": "coupon", "detail": "SAVE20: 20% of 9900 = -1980" },
    { "step": "total", "detail": "9900 - 1980 = 7920" }
  ],
  "requestId": "req_abc123"
}
```

### 37.2 `POST /v1/refund`

Request `{ invoice, amount: 1000, strategy: "proportional" }`; response shows how the 1000
is allocated across the original lines proportionally, with a trace — **a simulation, no
money moves.**

### 37.3 `GET /v1/simulations?cursor=...&limit=20`

```json
{
  "items": [ { "id": "sim_001", "label": "Pro + 5 seats + SAVE20",
               "total": 7920, "createdAt": "2025-06-15T00:01:00Z",
               "createdBy": "user_7" } ],
  "nextCursor": "b3k...",
  "total": 142
}
```

---

## 38. Regression-gate workflow example (GitHub Actions)

```yaml
name: ledgerflow billing gate
on: [pull_request]
jobs:
  billing-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./                       # the ledgerflow Action (Phase 6)
        with:
          context: ./billing/contexts/pro-5-seats.json
          expected: ./billing/expected/pro-5-seats.invoice.json
```

The job fails (blocking the PR) when `ledgerflow assert` detects the simulated invoice no
longer matches the committed expected invoice — i.e. a pricing change drifted unintentionally.
The job output is a readable diff of expected vs actual lines/totals/trace.

---

## 39. Observability detail (Phase 7 expansion)

**Logs (pino):** one JSON line per request with `requestId`, `principal`, `tenantId`,
`route`, `status`, `latencyMs`, and on simulate: `lineCount`, `total`, `couponCount`. Never
log tokens or full customer context.

**Metrics (`/metrics`):**
- `ledgerflow_requests_total{route,status}`
- `ledgerflow_request_duration_seconds{route}` (histogram)
- `ledgerflow_simulations_total`
- `ledgerflow_refunds_total{strategy}`
- `ledgerflow_errors_total{route,code}`

**Traces (OTel):** a span per request, child spans around `simulate`/`refund` and each DB
call; propagate `requestId` as a trace attribute.

**Readiness:** `/ready` checks DB connectivity and returns 503 when the DB is down;
`/health` is a pure liveness probe and stays 200.

**Tests:** assert each metric series appears after a request; assert `/ready` flips to 503
with a stubbed-down DB while `/health` stays 200; assert log lines parse as JSON with the
required fields and never contain a token.

---

## 40. Backward-compatibility contract

As ledgerflow scales, these must not break for existing users:

- **CLI invocation** — `ledgerflow simulate --input … --trace` keeps working with the same
  flags. New flags are additive only.
- **File-based usage** — simulating a context from a JSON file remains first-class; the API
  and library are additive, never required.
- **Invoice shape** — `{ invoice: { lines[], discounts[], subtotal, total }, trace[] }` is
  the stable contract the console, CI gate, and downstream billers depend on. Extend with
  optional fields only.
- **Trace step identifiers** — stable strings; renaming one is a breaking change needing a
  major bump + alias.
- **OpenAPI** — fields added, not removed/retyped, within a major API version.

Add a `test/compat/` suite that pins these contracts and fails on any breaking change so it
is a deliberate, reviewed decision.

---

## 41. Final checklist before calling it "scaled"

- [ ] Phases 0–10 DoDs all green.
- [ ] `npm run coverage` (core) and web coverage both ≥ 90% statements AND branches.
- [ ] `test/golden/` invoices byte-stable; `test/compat/` contracts intact.
- [ ] eslint 9 / zod 4 in place; no determinism regression after the bump.
- [ ] OpenAPI contract test green; console types match the spec.
- [ ] Billing-regression gate published and demonstrated blocking a PR on pricing drift.
- [ ] Production deploy brought up from scratch via the runbook, auth ON, migrations
      applied, secrets injected.
- [ ] No payment-processor credentials or money movement anywhere.
- [ ] Threat model + runbook + CHANGELOG written; version tagged.
- [ ] No local-folder-name references anywhere in the shipped artifacts.

---

## 42. Quick reference — the five things that matter most

1. **Auth before hosting** (Phase 1) — non-negotiable for a billing API.
2. **Repository interface before tenancy** (Phase 2 → 3) — scoping lives in one place.
3. **Protect determinism** — golden invoices gate every pricing change and every dep bump.
4. **Keep the simulation boundary** — no money movement, ever.
5. **Hold ≥ 90% coverage** — statements and branches, core and web, always, in CI.

Everything else in this playbook supports those five.

---

## 43. Billing edge-case checklist (each becomes a golden + unit test)

Money math is where billing engines quietly break. Every item below must have an explicit
fixture and assertion; rounding behavior in particular must be pinned.

- [ ] **Rounding:** half-up vs banker's rounding is chosen, documented, and consistent
      across every line; assert exact integer-cent results (never float-compare totals).
- [ ] **Currency:** amounts are integer minor units (cents); no floating-point money.
- [ ] **Zero-amount lines:** a 0 charge renders correctly and does not break totals.
- [ ] **100%-off coupon:** total floors at 0, never negative.
- [ ] **Stacked coupons exceeding subtotal:** total floors at 0; trace explains the cap.
- [ ] **Proration at period boundaries:** first day / last day of period handled exactly.
- [ ] **Mid-cycle upgrade and downgrade:** both directions produce correct partial charges.
- [ ] **Credit larger than the invoice:** remaining credit is carried, total is 0.
- [ ] **Refund larger than paid:** rejected with a typed error, not a negative invoice.
- [ ] **Multiple usage metrics:** each tier computed independently and summed exactly.
- [ ] **Tax applied after discounts** (or per the documented order) — order is pinned.
- [ ] **Idempotent simulate:** same context twice → identical id-free invoice + trace.

Pin each with an integer-cent golden so a future change that alters rounding or ordering
fails CI loudly rather than silently shifting customer totals.

---

## 44. Why determinism is the hill to die on

ledgerflow's adoption case is "trust the number." If the same context can produce two
different invoices, the product is worthless. Therefore:

- The billing core takes the clock as **input**, never reads it.
- No randomness, no map iteration-order dependence, no locale-dependent formatting in core.
- Every pricing change ships with an updated, reviewed golden — the diff *is* the change.
- The dependency refresh in Phase 0 is validated by re-running all goldens and proving
  byte-identical output; a dep that changes a number is a blocker, not a footnote.

If you remember one sentence from this playbook: **protect the determinism, hold 90%
coverage, and never move money.**

---

## 45. Refund strategy reference (encode each as a test)

| Strategy | Behavior | Test must assert |
|---|---|---|
| `proportional` | Allocate the refund across lines in proportion to their amount. | Sum of allocations equals the refund; per-line shares match ratios; integer-cent. |
| `last-first` | Refund newest lines first. | Ordering respected; remainder handled exactly. |
| `specific-line` | Refund a named line only. | Only the target line reduced; others unchanged. |
| over-refund | Refund > paid amount. | Rejected with a typed error; no negative invoice. |

Each strategy gets a golden refund breakdown so a future change to allocation math fails CI
loudly. Refunds are **simulations** — they explain how a refund *would* be allocated; they
never contact a processor.

---

## 46. One-line phase index (for quick navigation)

- **Phase 0** — Baseline lock, golden invoices, CI at 90%, eslint/zod refresh.
- **Phase 1** — API authentication (the blocker).
- **Phase 2** — Repository interface + PostgreSQL + migrations.
- **Phase 3** — Tenants + row-level isolation.
- **Phase 4** — Roles & permissions.
- **Phase 5** — `/v1` hardening: validation, pagination, idempotency, rate limits.
- **Phase 6** — Billing-regression gate (the adoption driver).
- **Phase 7** — Observability: logs, metrics, traces, readiness.
- **Phase 8** — Console scale-up: catalog, library, invoice viewer.
- **Phase 9** — Performance: benchmarks, indexes, caching.
- **Phase 10** — Release: secured, migrated production deploy + runbook + threat model.

Work them in order; never start one before the previous DoD is green; hold ≥ 90% coverage
the whole way.

*End of ledgerflow scaling playbook.*
