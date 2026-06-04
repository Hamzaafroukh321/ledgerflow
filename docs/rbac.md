# Roles And Permissions

LedgerFlow supports three tenant roles:

| Role | Permissions |
| --- | --- |
| `viewer` | Read catalog/library data and run non-persistent simulations, audits, comparisons, validations, aggregations, and refunds. |
| `editor` | Viewer permissions plus writes such as plan creation, usage ingest, customer/subscription writes, and saved simulations. |
| `admin` | Editor permissions plus administrative actions as they are introduced. |

The API returns a stable `403` envelope when a role is not allowed:

```json
{
  "error": {
    "code": "forbidden",
    "message": "This action requires write permission."
  }
}
```

The console reads `VITE_LEDGERFLOW_ROLE`; viewer mode hides write controls such as plan saving.
