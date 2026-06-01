# Architecture

LedgerFlow is organized as small rule modules behind a deterministic invoice engine.

The pipeline order is:

1. `buildBaseCharges`
2. `applyProration`
3. `applyUsage`
4. `applyDiscounts`
5. `applyCreditsPreTax`
6. `computeTax`
7. `applyCreditsPostTax`
8. `finalize`

Each stage returns integer minor-unit amounts and trace data. The engine does not persist invoices; storage repositories are used for plans, coupons, and idempotent usage events.
