# Performance and Scale Notes

ledgerflow keeps billing math deterministic while allowing the API layer to avoid repeated
work for identical resolved simulations.

## Simulation Cache

`POST /v1/invoices/simulate` resolves the tenant-scoped plan and coupon records, then builds a
SHA-256 cache key from the billing context plus those catalog records. A hit returns a cloned
invoice, so callers cannot mutate the cached value. The pure billing engine remains free of I/O,
clock reads, or process configuration.

The cache is intentionally in memory for this phase. It is bounded by entry count and shared by
the unversioned and `/v1` route registrations inside a server instance. The content hash includes
the resolved plan and coupon definitions, so catalog changes naturally produce a different key.

## Database Indexes

Migration `003_performance_indexes` adds tenant-scoped lookup and ordering indexes for plan,
coupon, usage, customer, and simulation-library reads. These complement the isolation indexes
from the tenant migration and keep paginated catalog/library queries aligned with the scoped
access pattern.

## Load Profile

Run a local server, then execute:

```powershell
npm run load:simulate
```

Useful environment variables:

```text
LEDGERFLOW_LOAD_URL=http://127.0.0.1:3100/v1/invoices/simulate
LEDGERFLOW_LOAD_TOKEN=<bearer token when auth is enabled>
LEDGERFLOW_LOAD_REQUESTS=120
LEDGERFLOW_LOAD_CONCURRENCY=12
```

The script reports total successes, failures, requests per second, and p50/p95/max latency in
JSON. A non-2xx response or connection failure counts as failed work and exits non-zero.

## Budget

The automated performance test exercises a large context with many usage records, stacked
coupons, and credits. It asserts the uncached path stays within a conservative local budget and
that the cache-hit path is measurably faster than the first run. The threshold is intentionally
loose enough for shared CI hosts while still catching accidental quadratic work in the API path.
