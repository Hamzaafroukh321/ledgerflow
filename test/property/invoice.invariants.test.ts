import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { defaultInvoiceEngine, Money, prorate, type BillingContext } from "../../src/index.js";

describe("invoice invariants", () => {
  it("keeps totals internally consistent and deterministic", () => {
    fc.assert(
      fc.property(
        fc.record({
          seats: fc.integer({ min: 1, max: 40 }),
          apiCalls: fc.integer({ min: 0, max: 50000 }),
          creditMinor: fc.integer({ min: 0, max: 50000 }),
          coupon: fc.option(fc.constantFrom("SAVE20", "LESS500"), { nil: undefined }),
          exempt: fc.boolean()
        }),
        ({ seats, apiCalls, creditMinor, coupon, exempt }) => {
          const context: BillingContext = {
            currency: "USD",
            period: { start: "2025-01-01", end: "2025-02-01" },
            customer: {
              id: "cus_property",
              taxProfile: { exempt, jurisdiction: "US-CA" }
            },
            subscription: { planId: "pro_monthly", seats, changedOn: null },
            usage: [{ meter: "api_calls", quantity: apiCalls }],
            coupons: coupon ? [coupon] : [],
            credits:
              creditMinor > 0
                ? [{ id: "cr_property", amountMinor: creditMinor, phase: "post_tax" }]
                : []
          };

          const invoice = defaultInvoiceEngine.simulate(context);
          const repeated = defaultInvoiceEngine.simulate(context);
          const chargeableTax = invoice.taxLines
            .filter((line) => !line.inclusive)
            .reduce((sum, line) => sum + line.amountMinor, 0);
          const expectedTotal = Math.max(
            0,
            invoice.totals.subtotal +
              invoice.totals.discountTotal +
              invoice.totals.creditTotal +
              chargeableTax
          );

          expect(invoice).toEqual(repeated);
          expect(invoice.totals.total).toBe(expectedTotal);
          expect(invoice.totals.subtotal).toBe(
            invoice.lineItems.reduce((sum, item) => sum + item.amountMinor, 0)
          );
          expect(invoice.totals.discountTotal).toBe(
            invoice.discounts.reduce((sum, discount) => sum + discount.amountMinor, 0)
          );
          expect(invoice.totals.creditTotal).toBe(
            invoice.creditsApplied.reduce((sum, credit) => sum + credit.amountMinor, 0)
          );
          expect(invoice.totals.total).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 75 }
    );
  });

  it("never creates negative prorated charges for valid active intervals", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 31 }),
        fc.integer({ min: 1, max: 50000 }),
        (startOffset, amountMinor) => {
          const startDay = String(1 + Math.min(startOffset, 30)).padStart(2, "0");
          const result = prorate(new Money(amountMinor, "USD"), {
            start: "2025-01-01",
            end: "2025-02-01"
          }, {
            start: `2025-01-${startDay}`,
            end: "2025-02-01"
          });

          expect(result.amount.amountMinor).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 75 }
    );
  });
});
