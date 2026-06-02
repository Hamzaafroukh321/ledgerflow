# Silver Task Candidates

Strong candidates are marked with `Top 5: yes`.

## Candidate: Serve React App Without Breaking API Routes

Top 5: yes

Area:
Fastify server static hosting, Docker runtime, frontend build output.

Base commit:
`673e490`

Fix commit:
`eb5f33f`

Bug or feature gap:
The Docker image served only API routes, so the production-style container did not expose the React operations console.

Expected behavior:
When static hosting is enabled, HTML routes serve `web/dist/index.html`, while API routes, `/docs`, and `/openapi.json` continue to work.

Tests:

- `api > does not serve the web app unless static hosting is enabled`
- `api > serves the web app and keeps API routes available when static hosting is enabled`

Why this is a good Silver task:
It requires understanding runtime env flags, Fastify route precedence, Docker build stages, and frontend build output.

Why it is not too easy:
A shallow fix can accidentally catch API 404s or break Swagger UI.

Why it is not impossible:
The failing tests point at route behavior and the Dockerfile shows where runtime files are copied.

Wrong fixes that should fail:

- Always serving the SPA for every missing route, including JSON API calls.
- Copying source frontend files without building `web/dist`.

## Candidate: Playwright Critical Paths Use Real API Contracts

Top 5: yes

Area:
Web schemas, simulator context builder, refund page, scenario delta rendering, Playwright e2e.

Base commit:
`edcdf7e`

Fix commit:
`1155458`

Bug or feature gap:
The frontend accepted shapes that did not match real API responses, including audit summaries, scenario deltas, refund credit notes, and explanation trace children.

Expected behavior:
The browser workflows should pass against the real API without schema mismatches or stale mocked contracts.

Tests:

- `critical-paths.spec.ts > catalog, simulator, and audit workflows run against the API`
- `critical-paths.spec.ts > operations pages create customers, usage, scenarios, and refunds`

Why this is a good Silver task:
It crosses UI, schema validation, generated billing contexts, and backend contracts.

Why it is not too easy:
Fixing one schema mismatch still leaves other workflows failing.

Why it is not impossible:
Playwright error output identifies the user-visible workflow and backend envelope.

Wrong fixes that should fail:

- Loosening schemas to `unknown`.
- Mocking e2e API responses instead of exercising the server.

## Candidate: SQLite Volume Is Writable By Non-Root Container User

Top 5: yes

Area:
Dockerfile runtime user, Compose volume, SQLite repository path.

Base commit:
`1155458`

Fix commit:
`673e490`

Bug or feature gap:
Compose mounted `/data`, but the runtime container ran as a non-root user without explicit ownership, risking SQLite write failures.

Expected behavior:
The container starts healthy and can create `/data/ledgerflow.sqlite` through `LEDGERFLOW_DB`.

Tests:

- Docker Compose health probe.
- `/data` writability and SQLite file existence probe.

Why this is a good Silver task:
It combines Docker runtime permissions, environment configuration, and storage initialization.

Why it is not too easy:
The code can pass local API tests while failing only in containerized persistence.

Why it is not impossible:
Compose configuration and Dockerfile user setup are small and inspectable.

Wrong fixes that should fail:

- Running the whole app as root.
- Writing SQLite into an unmounted application directory.

## Candidate: Scenario Delta Rendering Uses Backend `from` and `to`

Top 5: yes

Area:
Scenario comparison schema, delta table, scenario page tests.

Base commit:
`edcdf7e`

Fix commit:
`1155458`

Bug or feature gap:
The web app expected a `candidate` field but the API returns `from` and `to`, so scenario comparisons failed against the server.

Expected behavior:
Delta rows render the candidate name from `to` and preserve baseline/candidate validity comparisons.

Tests:

- `DeltaTable > renders signed money deltas and validity changes`
- `ScenarioPage > submits contexts and renders candidate deltas`

Why this is a good Silver task:
It requires following a response shape from API contract to UI state and table rendering.

Why it is not too easy:
Renaming only one access leaves keys, validity lookup, or tests broken.

Why it is not impossible:
The schema and component sit close together.

Wrong fixes that should fail:

- Deriving candidate names from array order.
- Ignoring validity state.

## Candidate: Trace Nodes Must Carry Children For Backend Reconciliation

Top 5: yes

Area:
Invoice schema, audit sample invoice, refund fixtures, trace tree tests.

Base commit:
`edcdf7e`

Fix commit:
`1155458`

Bug or feature gap:
Frontend sample invoices allowed trace nodes without `children`, while backend reconciliation requires an array.

Expected behavior:
Every trace node sent to the API includes `children`, using an empty array for leaves.

Tests:

- `schemas > parses recursive invoice traces`
- `AuditPage > audits pasted invoice JSON`
- Playwright audit workflow.

Why this is a good Silver task:
It links type schemas, page fixtures, backend audit behavior, and recursive UI components.

Why it is not too easy:
Only fixing the top-level sample misses nested trace leaves.

Why it is not impossible:
Backend `reconcile` and frontend `traceNodeSchema` make the invariant visible.

Wrong fixes that should fail:

- Making backend reconciliation accept malformed traces silently.
- Removing trace validation from the frontend.

## Candidate: Omit Zero Credits From Simulator Contexts

Area:
Simulator form builder, billing context schema, invoice simulation endpoint.

Base commit:
`edcdf7e`

Fix commit:
`1155458`

Bug or feature gap:
The simulator emitted zero-value credits, but the API accepts only meaningful positive credit amounts.

Expected behavior:
Empty or zero credit inputs are omitted from the generated billing context.

Tests:

- `SimulatorPage > builds a billing context from form values`
- Playwright simulator workflow.

Why this is a good Silver task:
It requires knowing the difference between an absent adjustment and a zero adjustment.

Why it is not too easy:
Changing the API schema instead can permit invalid domain data.

Why it is not impossible:
The form builder is focused and tests show the generated context.

Wrong fixes that should fail:

- Sending zero credits and loosening backend validation.
- Dropping non-zero credit values.

## Candidate: SQLite Persists Customer Billing Profiles

Area:
SQLite storage, customer repository, Fastify default dependency wiring, API restart behavior.

Base commit:
`bb3059c`

Fix commit:
`147c88a`

Bug or feature gap:
When `LEDGERFLOW_DB` was configured, plans, coupons, and usage events used SQLite, but customers and subscription assignments stayed in memory. Customer profiles disappeared after an API restart even though the app was in persistent mode.

Expected behavior:
SQLite-backed deployments persist customers and subscription assignments, and `buildServer({}, { LEDGERFLOW_DB })` uses the passed environment consistently for default repositories.

Tests:

- `storage > persists customers and subscriptions across sqlite repository instances`
- `api > uses sqlite repositories when LEDGERFLOW_DB is configured`
- `api > persists customer profiles through sqlite-backed API restarts`

Why this is a good Silver task:
It requires understanding repository contracts, optional JSON fields, SQLite migration shape, API dependency construction, and server shutdown lifecycle.

Why it is not too easy:
Persisting customers alone is not enough; billing profiles also depend on subscription upsert semantics and the server must release SQLite handles on close.

Why it is not impossible:
The memory repository defines the target contract and existing SQLite repositories show the migration and adapter pattern.

Wrong fixes that should fail:

- Persisting customers but leaving subscriptions memory-only.
- Making the API test pass by constructing custom repositories instead of honoring `LEDGERFLOW_DB`.
- Requiring plans or customers to exist before saving subscriptions, which would change the existing repository contract.

## Candidate: Saved Simulation Runs Survive Restarts

Area:
Simulation history domain model, API routes, repository contracts, memory and SQLite storage.

Base commit:
`98b4005`

Fix commit:
`d2f78a5`

Bug or feature gap:
The simulator returned invoices only as transient responses. Operators could not save a simulation run, inspect prior generated invoices, or persist run history in SQLite-backed deployments.

Expected behavior:
The API can create, list, and fetch saved simulation runs containing the validated billing context and generated invoice, with SQLite persistence and newest-first history ordering.

Tests:

- `storage > memory repositories satisfy the contract`
- `storage > provides typed sqlite repository adapters`
- `storage > persists simulation runs across sqlite repository instances`
- `api > creates, lists, and retrieves saved simulation runs`

Why this is a good Silver task:
It adds a meaningful product workflow while crossing engine validation, API contracts, repository abstractions, persistence migrations, exports, and tests.

Why it is not too easy:
Saving only the request body is insufficient; the run needs the generated invoice, stable retrieval, deterministic ordering, and matching memory/SQLite behavior.

Why it is not impossible:
Existing usage and customer repositories provide implementation patterns, and the invoice simulator already supplies the core calculation.

Wrong fixes that should fail:

- Storing only invoice totals instead of the full invoice and original context.
- Returning saved runs from memory while SQLite deployments lose them after restart.
- Accepting arbitrary unvalidated contexts when creating saved runs.

## Candidate: HTML SPA Routes Must Not Return API JSON

Area:
Fastify static hosting, overlapping GET API routes, React router deep links, saved simulations page.

Base commit:
`85b4878`

Fix commit:
`522a559`

Bug or feature gap:
Direct browser requests to frontend paths that overlap GET API routes, such as `/plans`, `/customers`, and `/simulations`, returned API JSON instead of the React app when static hosting was enabled.

Expected behavior:
When static web serving is enabled and the request accepts HTML, overlapping frontend routes serve `index.html`. API clients that request JSON continue receiving normal API responses.

Tests:

- `api > serves the web app and keeps API routes available when static hosting is enabled`
- Playwright production-page smoke check for `/simulations`

Why this is a good Silver task:
It requires understanding Fastify route precedence, browser Accept headers, SPA deep links, and preserving API behavior for JSON clients.

Why it is not too easy:
Serving the SPA for every overlapping route can break API consumers, while leaving route precedence alone breaks refresh/deep-link behavior in production.

Why it is not impossible:
The failure is visible from a direct browser load and can be captured with a small route-level regression test.

Wrong fixes that should fail:

- Moving API routes behind a new prefix without updating every client.
- Returning `index.html` for JSON API requests.
- Only fixing `/simulations` while leaving existing `/plans` and `/customers` deep links broken.
