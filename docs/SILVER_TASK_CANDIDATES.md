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
