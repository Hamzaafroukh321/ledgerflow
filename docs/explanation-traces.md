# Explanation Traces

Every invoice has a root explanation trace. The root total equals the invoice total, and child nodes represent subtotal, discounts, credits, and tax.

`reconcile(trace)` verifies that child totals sum exactly to parent totals all the way down the tree. This invariant keeps trace explanations auditable and penny-accurate.
