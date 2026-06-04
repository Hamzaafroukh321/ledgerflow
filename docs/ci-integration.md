# CI Integration

LedgerFlow can run as a billing regression gate in CI. The gate simulates a billing context and compares the result with an expected invoice JSON file.

## CLI

```sh
npm ci
npm run build
node dist/cli/index.js assert --context examples/invoice-basic.json --expected test/golden/fixtures/invoice-basic.invoice.json
```

Exit-code contract:

- `0`: the simulated invoice exactly matches the expected invoice.
- `1`: the simulated invoice drifted, the command prints a field-level diff, and CI should fail.

Example drift output:

```text
Billing assertion drift detected:
$.totals.total: expected 3000, actual 2900
```

## GitHub Action

Use the bundled composite Action from a repository that contains LedgerFlow:

```yaml
name: billing

on:
  pull_request:

jobs:
  billing-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./
        with:
          context: examples/invoice-basic.json
          expected: test/golden/fixtures/invoice-basic.invoice.json
```

Keep expected invoices in version control beside the contexts they protect. When a pricing change is intentional, update the expected invoice in the same change as the pricing logic and review the diff.
