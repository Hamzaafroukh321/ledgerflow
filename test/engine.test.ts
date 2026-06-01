import { describe, expect, it } from "vitest";

import { defaultInvoiceEngine, pipelineStages, reconcile, type BillingContext } from "../src/index.js";

describe("InvoiceEngine", () => {
  const context: BillingContext = {
    currency: "USD",
    period: { start: "2025-01-01", end: "2025-02-01" },
    customer: { id: "cus_1", taxProfile: { exempt: false, jurisdiction: "US-CA" } },
    subscription: { planId: "pro_monthly", seats: 5, changedOn: null },
    usage: [{ meter: "api_calls", quantity: 12000 }],
    coupons: ["SAVE20"],
    credits: [{ id: "cr_1", amountMinor: 500, phase: "pre_tax" }]
  };

  it("runs the ordered billing pipeline deterministically", () => {
    expect(pipelineStages).toEqual([
      "buildBaseCharges",
      "applyProration",
      "applyUsage",
      "applyDiscounts",
      "applyCreditsPreTax",
      "computeTax",
      "applyCreditsPostTax",
      "finalize"
    ]);

    expect(defaultInvoiceEngine.simulate(context)).toEqual(defaultInvoiceEngine.simulate(context));
  });

  it("simulates a complete invoice with reconciling trace totals", () => {
    const invoice = defaultInvoiceEngine.simulate(context);

    expect(invoice.lineItems.map((line) => line.amountMinor)).toEqual([9995, 2000]);
    expect(invoice.discounts).toEqual([{ code: "SAVE20", amountMinor: -2399 }]);
    expect(invoice.creditsApplied).toEqual([{ id: "cr_1", amountMinor: -500, phase: "pre_tax" }]);
    expect(invoice.totals).toEqual({
      subtotal: 11995,
      discountTotal: -2399,
      creditTotal: -500,
      tax: 659,
      total: 9755
    });
    expect(reconcile(invoice.explanation)).toBe(true);
  });
});
