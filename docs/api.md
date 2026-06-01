# API

## `GET /health`

Returns `{ "status": "ok" }`.

## `GET /plans`

Returns configured plans.

## `POST /invoices/simulate`

Accepts a billing context and returns an invoice with `lineItems`, `discounts`, `creditsApplied`, `taxLines`, `totals`, and `explanation`.

## `POST /invoices/audit`

Accepts an invoice and returns an audit report with invariant violations for totals, trace reconciliation, signs, currencies, and tax sanity.

## `POST /scenarios/compare`

Accepts `{ "baseline": { "name": "...", "context": {} }, "candidates": [{ "name": "...", "context": {} }] }` and returns simulated invoices plus total deltas between baseline and each candidate.

## `POST /usage/events`

Accepts a usage event keyed by `idempotencyKey`. Duplicate keys return HTTP 409.

## `GET /usage/events`

Returns accepted usage events. This is intended for operational inspection and debugging invoice inputs.

## `POST /usage/aggregate`

Accepts `{ "customerId": "cus_1", "period": { "start": "2025-01-01", "end": "2025-02-01" } }` and returns meter totals for events inside the period. Omit `customerId` to aggregate all accepted usage events.

## `POST /coupons/validate`

Accepts `{ "code": "SAVE20", "context": {} }` and returns coupon validity.

## `POST /refunds/simulate`

Accepts an invoice, `amountMinor`, and refund `strategy`, then returns allocations and a credit note.

## `GET /customers`

Returns stored customer records.

## `POST /customers`

Creates or replaces a customer with tax profile metadata.

## `POST /subscriptions`

Creates or replaces a subscription assignment for a customer.

## `GET /customers/:customerId/billing-profile?onDate=YYYY-MM-DD`

Returns the customer and active subscription assignment for the requested date.

Validation failures return HTTP 400 with `{ "error": { "code": "validation_error", "message": "...", "details": [] } }`.
