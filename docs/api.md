# API

## `GET /health`

Returns `{ "status": "ok" }`.

## `GET /plans`

Returns configured plans.

## `POST /invoices/simulate`

Accepts a billing context and returns an invoice with `lineItems`, `discounts`, `creditsApplied`, `taxLines`, `totals`, and `explanation`.

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

Validation failures return HTTP 400 with `{ "error": { "code": "validation_error", "message": "...", "details": [] } }`.
