# LedgerFlow

LedgerFlow is a deterministic billing rules engine and invoice simulation toolkit for SaaS teams. It turns a billing context into a fully explained invoice without moving money or contacting payment processors.

## Install

```sh
npm install
npm run build
```

## Development

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## CLI Quick Start

```sh
npm run build
node dist/cli/index.js plans --pretty
node dist/cli/index.js simulate --input examples/invoice-basic.json --pretty --trace
node dist/cli/index.js validate-coupon --code SAVE20 --input examples/invoice-coupon-stack.json
node dist/cli/index.js refund --invoice examples/refund-partial.json --amount 1000 --strategy proportional
```

## API Quick Start

```sh
node dist/cli/index.js serve --port 3000
```

Endpoints include `GET /health`, `GET /plans`, `POST /invoices/simulate`, `POST /usage/events`, `POST /coupons/validate`, and `POST /refunds/simulate`.

## Worked Example

`examples/invoice-usage.json` charges five Pro seats plus API overage. The invoice response contains line items, discounts, credits, taxes, totals, and an explanation trace whose children reconcile to the invoice total.
