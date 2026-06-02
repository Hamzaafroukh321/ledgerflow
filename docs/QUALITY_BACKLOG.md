# Quality Backlog

This backlog records regression risks, bug history, and reliability improvements
that are worth preserving as focused engineering work. Each item describes the
affected area, the expected behavior, existing coverage, and failure modes that
future changes should continue to catch.

## Serve React App Without Breaking API Routes

Area:
Fastify server static hosting, Docker runtime, frontend build output.

Regression history:
The Docker image served only API routes, so the production-style container did
not expose the React operations console.

Expected behavior:
When static hosting is enabled, HTML routes serve `web/dist/index.html`, while
API routes, `/docs`, and `/openapi.json` continue to work.

Coverage:

- `api > does not serve the web app unless static hosting is enabled`
- `api > serves the web app and keeps API routes available when static hosting is enabled`

Engineering notes:
This area combines runtime environment flags, Fastify route precedence, Docker
build stages, and frontend build output.

Failure modes to guard:

- Serving the SPA for every missing route, including JSON API calls.
- Copying source frontend files without building `web/dist`.

## Playwright Critical Paths Use Real API Contracts

Area:
Web schemas, simulator context builder, refund page, scenario delta rendering,
Playwright e2e.

Regression history:
The frontend accepted shapes that did not match real API responses, including
audit summaries, scenario deltas, refund credit notes, and explanation trace
children.

Expected behavior:
The browser workflows should pass against the real API without schema mismatches
or stale mocked contracts.

Coverage:

- `critical-paths.spec.ts > catalog, simulator, and audit workflows run against the API`
- `critical-paths.spec.ts > operations pages create customers, usage, scenarios, and refunds`

Engineering notes:
This area crosses UI state, schema validation, generated billing contexts, and
backend contracts.

Failure modes to guard:

- Loosening schemas to `unknown`.
- Mocking e2e API responses instead of exercising the server.

## SQLite Volume Is Writable By Non-Root Container User

Area:
Dockerfile runtime user, Compose volume, SQLite repository path.

Regression history:
Compose mounted `/data`, but the runtime container ran as a non-root user
without explicit ownership, risking SQLite write failures.

Expected behavior:
The container starts healthy and can create `/data/ledgerflow.sqlite` through
`LEDGERFLOW_DB`.

Coverage:

- Docker Compose health probe.
- `/data` writability and SQLite file existence probe.

Engineering notes:
This area combines Docker runtime permissions, environment configuration, and
storage initialization.

Failure modes to guard:

- Running the whole app as root.
- Writing SQLite into an unmounted application directory.

## Scenario Delta Rendering Uses Backend `from` and `to`

Area:
Scenario comparison schema, delta table, scenario page tests.

Regression history:
The web app expected a `candidate` field but the API returns `from` and `to`, so
scenario comparisons failed against the server.

Expected behavior:
Delta rows render the comparison name from `to` and preserve baseline/comparison
validity checks.

Coverage:

- `DeltaTable > renders signed money deltas and validity changes`
- `ScenarioPage > submits contexts and renders candidate deltas`

Engineering notes:
This area requires following a response shape from API contract to UI state and
table rendering.

Failure modes to guard:

- Deriving comparison names from array order.
- Ignoring validity state.

## Trace Nodes Must Carry Children For Backend Reconciliation

Area:
Invoice schema, audit sample invoice, refund fixtures, trace tree tests.

Regression history:
Frontend sample invoices allowed trace nodes without `children`, while backend
reconciliation requires an array.

Expected behavior:
Every trace node sent to the API includes `children`, using an empty array for
leaves.

Coverage:

- `schemas > parses recursive invoice traces`
- `AuditPage > audits pasted invoice JSON`
- Playwright audit workflow.

Engineering notes:
This area links type schemas, page fixtures, backend audit behavior, and
recursive UI components.

Failure modes to guard:

- Making backend reconciliation accept malformed traces silently.
- Removing trace validation from the frontend.

## Omit Zero Credits From Simulator Contexts

Area:
Simulator form builder, billing context schema, invoice simulation endpoint.

Regression history:
The simulator emitted zero-value credits, but the API accepts only meaningful
positive credit amounts.

Expected behavior:
Empty or zero credit inputs are omitted from the generated billing context.

Coverage:

- `SimulatorPage > builds a billing context from form values`
- Playwright simulator workflow.

Engineering notes:
This area distinguishes between an absent adjustment and a zero adjustment.

Failure modes to guard:

- Sending zero credits and loosening backend validation.
- Dropping non-zero credit values.

## SQLite Persists Customer Billing Profiles

Area:
SQLite storage, customer repository, Fastify default dependency wiring, API
restart behavior.

Regression history:
When `LEDGERFLOW_DB` was configured, plans, coupons, and usage events used
SQLite, but customers and subscription assignments stayed in memory. Customer
profiles disappeared after an API restart even though the app was in persistent
mode.

Expected behavior:
SQLite-backed deployments persist customers and subscription assignments, and
`buildServer({}, { LEDGERFLOW_DB })` uses the passed environment consistently
for default repositories.

Coverage:

- `storage > persists customers and subscriptions across sqlite repository instances`
- `api > uses sqlite repositories when LEDGERFLOW_DB is configured`
- `api > persists customer profiles through sqlite-backed API restarts`

Engineering notes:
This area covers repository contracts, optional JSON fields, SQLite migration
shape, API dependency construction, and server shutdown lifecycle.

Failure modes to guard:

- Persisting customers but leaving subscriptions memory-only.
- Making the API test pass by constructing custom repositories instead of honoring `LEDGERFLOW_DB`.
- Requiring plans or customers to exist before saving subscriptions, which would change the existing repository contract.

## Saved Simulation Runs Survive Restarts

Area:
Simulation history domain model, API routes, repository contracts, memory and
SQLite storage.

Regression history:
The simulator returned invoices only as transient responses. Operators could not
save a simulation run, inspect prior generated invoices, or persist run history
in SQLite-backed deployments.

Expected behavior:
The API can create, list, and fetch saved simulation runs containing the
validated billing context and generated invoice, with SQLite persistence and
newest-first history ordering.

Coverage:

- `storage > memory repositories satisfy the contract`
- `storage > provides typed sqlite repository adapters`
- `storage > persists simulation runs across sqlite repository instances`
- `api > creates, lists, and retrieves saved simulation runs`

Engineering notes:
This area crosses engine validation, API contracts, repository abstractions,
persistence migrations, exports, and tests.

Failure modes to guard:

- Storing only invoice totals instead of the full invoice and original context.
- Returning saved runs from memory while SQLite deployments lose them after restart.
- Accepting arbitrary unvalidated contexts when creating saved runs.

## HTML SPA Routes Must Not Return API JSON

Area:
Fastify static hosting, overlapping GET API routes, React router deep links,
saved simulations page.

Regression history:
Direct browser requests to frontend paths that overlap GET API routes, such as
`/plans`, `/customers`, and `/simulations`, returned API JSON instead of the
React app when static hosting was enabled.

Expected behavior:
When static web serving is enabled and the request accepts HTML, overlapping
frontend routes serve `index.html`. API clients that request JSON continue
receiving normal API responses.

Coverage:

- `api > serves the web app and keeps API routes available when static hosting is enabled`
- Playwright production-page smoke check for `/simulations`

Engineering notes:
This area requires preserving API behavior while supporting SPA refreshes and
deep links.

Failure modes to guard:

- Moving API routes behind a new prefix without updating every client.
- Returning `index.html` for JSON API requests.
- Only fixing `/simulations` while leaving existing `/plans` and `/customers` deep links broken.

## Custom Plans Must Be Billable Immediately

Area:
Plan catalog API, repository-backed invoice engine, Plans page editor, frontend
schemas.

Regression history:
The codebase had repository `save(plan)` support, but no API or UI to create
custom plans. When a plan was added through storage, the invoice engine still
used static default plan records, so newly saved plans could not be simulated.

Expected behavior:
Operators can create or update a plan from the API or Plans page, see it in the
catalog, and immediately simulate invoices against that plan. SQLite-backed
deployments persist custom catalog changes.

Coverage:

- `api > creates custom catalog plans and uses them for simulation`
- `PlansPage > creates a plan and refetches the catalog`
- `api client > creates catalog plans with JSON bodies`
- Playwright production-page smoke check for saving a plan on `/plans`

Engineering notes:
This area crosses API validation, repository-backed billing logic, frontend
schemas, React Query cache invalidation, and production UI behavior.

Failure modes to guard:

- Saving the plan but leaving simulation on static `DEFAULT_PLANS`.
- Loosening frontend schemas to accept arbitrary component objects.
- Refetching the catalog only in tests while the real UI remains stale after save.
