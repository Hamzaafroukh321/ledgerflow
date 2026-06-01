# MVP Hardening Plan

This plan scopes one additional day of work focused on moving LedgerFlow from a working build to a more deliverable MVP.

## Goals

1. Make core billing rules safer under edge-case input.
2. Add regression tests for boundary behavior that can cost real money.
3. Improve API and CLI error behavior so operators get predictable JSON failures.
4. Tighten storage contracts and idempotency semantics.
5. Keep the repository shippable after every commit with lint, typecheck, tests, build, smoke, and scan.

## 24-Hour Work Blocks

### Block 1: Correctness Edge Cases

- Money: negative rounding, invalid currencies, overflow-safe integer operations, and negative allocations.
- Allocation: zero weights, negative totals, deterministic tie-breaks, and large remainders.
- Pricing: unsorted tiers, tier gaps, missing infinity tier, non-integer quantities, included usage boundaries.
- Discounts: coupon validation before application, cross-currency line rejection, applies-to misses, fixed coupons capped at subtotal, percent coupon bounds.
- Credits: phase filtering, zero invoice balances, multiple credits, remaining credit order.
- Tax: unknown jurisdictions, inclusive tax after discounts, pre-tax credit ordering, zero and negative taxable bases.
- Proration: invalid intervals, effective intervals outside the billing period, leap-year periods.
- Refunds: invalid strategies, negative line totals, zero refundable invoices, proportional penny allocation.

### Block 2: API and CLI Product Behavior

- Return typed HTTP errors for validation, not-found, conflict, and domain-rule failures.
- Add CLI integration tests against built artifacts.
- Validate refund requests with real invoice shape checks.
- Ensure JSON output never contains omitted properties as `undefined`.

### Block 3: Storage and Idempotency

- Split SQLite repositories by interface or expose typed adapters.
- Detect idempotency conflicts where the same key arrives with different payload content.
- Add repository contract tests for plan/coupon round trips with optional fields.

### Block 4: Release Confidence

- Expand smoke checks to simulate refunds and coupon validation.
- Add a fixture matrix for tax-exempt, reverse-charge, inclusive-tax, and over-credit scenarios.
- Run coverage and review gaps by module.
- Keep `scripts/scan.sh` strict about generated files and markers.

## First Batch To Implement

The first batch prioritizes the highest-risk money movement paths:

- stricter coupon validation inside `applyDiscounts`
- cross-currency discount rejection
- tier validation for pricing components
- more precise API error mapping
- CLI JSON cleanup and refund strategy validation
- edge-case tests covering those behaviors
