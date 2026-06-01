# API

## `GET /health`

Returns `{ "status": "ok" }`.

## `GET /plans`

Returns configured plans.

## `POST /invoices/simulate`

Accepts a billing context and returns an invoice with `lineItems`, `discounts`, `creditsApplied`, `taxLines`, `totals`, and `explanation`.

## `POST /usage/events`

Accepts a usage event keyed by `idempotencyKey`. Duplicate keys return HTTP 409.

## `POST /coupons/validate`

Accepts `{ "code": "SAVE20", "context": {} }` and returns coupon validity.

## `POST /refunds/simulate`

Accepts an invoice, `amountMinor`, and refund `strategy`, then returns allocations and a credit note.

Validation failures return HTTP 400 with `{ "error": { "code": "validation_error", "message": "...", "details": [] } }`.
