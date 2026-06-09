# Threat Model

LedgerFlow is a deterministic billing simulation service. It accepts billing contexts, catalog
records, coupons, usage events, and saved simulation requests; it returns explained invoices and
audit results. It does not charge cards, create payouts, or contact payment processors; it never
moves money.

## Assets

- Tenant-scoped plan, coupon, customer, usage, and saved-simulation records.
- API bearer tokens and membership mappings.
- Invoice outputs and explanation traces used by finance and engineering teams.
- Release images, migrations, and operator configuration.

## Trust Boundaries

- Browser console to Fastify API.
- API process to repository adapter.
- Runtime container to Postgres.
- CI/release scripts to Docker Compose.
- CLI file input to deterministic billing core.

## Controls

- Auth is required on every non-public route when `LEDGERFLOW_API_TOKEN` or
  `LEDGERFLOW_API_TOKENS` is configured.
- Tenant isolation is enforced through scoped repositories instead of per-route filtering.
- Roles gate writes and membership management.
- Zod validates request bodies and query strings.
- Request IDs appear in responses, logs, and error envelopes.
- `/ready` verifies repository reachability while `/health` stays a pure liveness check.
- Production compose keeps Postgres private to the Compose network.
- The release verifier checks auth enforcement, readiness, seeded catalog access, and Compose
  startup from scratch.
- Golden invoices and coverage gates protect deterministic billing behavior.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Token leakage through logs | Do not log authorization headers; structured logs include subject and tenant only. |
| Cross-tenant data exposure | Scoped repository contract tests cover plans, coupons, usage, customers, subscriptions, and simulations. |
| Billing drift | Golden fixtures, property tests, and the `ledgerflow assert` gate fail on unintended invoice changes. |
| Unbounded request size | Body-size limits and rate limits are configured through documented environment variables. |
| Database outage | `/ready` returns unavailable while `/health` continues to report process liveness. |
| Accidental real-money integration | Product scope explicitly excludes money movement; tests and docs preserve the simulation boundary. |

## Review Checklist

- Run `.\scripts\verify.ps1`.
- Run `.\scripts\verify-release.ps1`.
- Confirm `LEDGERFLOW_API_TOKEN` is set in shared environments.
- Confirm Postgres is not exposed directly from the production compose file.
- Confirm new endpoints have validation schemas, OpenAPI coverage, and docs.
- Confirm no code path in the billing core reads clocks, randomness, network, or process env.
