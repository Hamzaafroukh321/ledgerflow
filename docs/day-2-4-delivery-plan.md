# Day 2-4 Delivery Plan

This plan continues MVP hardening after the initial build and Day 1 edge-case pass.

## Day 2: Product Defaults and Domain Contracts

- Move built-in plans and coupons into a catalog module that API, CLI, and engine can share.
- Seed default repositories so `GET /plans` and coupon validation work in a fresh server.
- Add tests for default catalog availability and default coupon validation.
- Keep domain contracts explicit: typed storage adapters, deterministic engine defaults, and no hidden empty states.

## Day 3: Operator Workflows

- Add usage inspection and period aggregation endpoints for debugging simulation inputs.
- Add CLI commands for listing plans and inspecting usage where it helps smoke testing.
- Improve error responses so expected product failures are typed and stable.
- Expand smoke checks beyond the happy-path invoice simulation.

## Day 4: Release Readiness

- Add a final release checklist for packaging, Docker, smoke, scan, and coverage.
- Add more scenario fixtures for operational flows, not only invoices.
- Re-run clean install, coverage, smoke, scan, Docker build, and Compose health.
- Document remaining non-MVP limitations clearly instead of burying them.

## Acceptance Criteria

- Fresh API server exposes default plans and default coupons.
- Usage ingestion can be inspected and aggregated through API routes.
- CLI smoke covers at least one non-invoice command.
- Full verification remains green after every slice.
- `main` is pushed after each verified commit.
