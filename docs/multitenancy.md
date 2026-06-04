# Multitenancy

LedgerFlow resolves each authenticated API token to a principal with a `tenantId`. Routes obtain a tenant-scoped repository for the current request, and catalog, usage, customer, subscription, and saved simulation operations go through that scoped repository.

## Token Mapping

Single-tenant deployments can keep using `LEDGERFLOW_API_TOKEN`; those requests resolve to the `default` tenant.

Multi-tenant deployments use `LEDGERFLOW_API_TOKENS`:

```bash
LEDGERFLOW_API_TOKENS=token-a:tenant-a:user-a,token-b:tenant-b:user-b
```

Each entry is `token:tenantId[:subject]`. The optional subject is used as the principal id; when omitted it defaults to `api-token`.

## Isolation Contract

- `GET /plans`, `GET /simulations`, and other list endpoints return only records owned by the caller's tenant.
- Reads for another tenant's plan, coupon, customer, subscription, usage event, or saved simulation behave as missing data.
- Writes are stamped through the tenant-scoped repository before reaching the backing adapter.
- Postgres migrations add tenant, user, membership, tenant ownership columns, and tenant-first indexes. SQLite and in-memory development paths use the same repository scoping contract.

Cross-tenant endpoint and repository tests cover private plans, coupons, and saved simulations so a caller cannot list, read, or simulate with another tenant's data.
