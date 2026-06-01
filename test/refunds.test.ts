import { describe, expect, it } from "vitest";

import { allocateRefund, type Invoice } from "../src/index.js";

describe("refunds", () => {
  const invoice: Invoice = {
    id: "inv_1",
    currency: "USD",
    lineItems: [
      { id: "base", description: "Base", amountMinor: 7000, currency: "USD", traceId: "base" },
      { id: "usage", description: "Usage", amountMinor: 3000, currency: "USD", traceId: "usage" }
    ],
    discounts: [{ code: "SAVE", amountMinor: -1000 }],
    creditsApplied: [],
    taxLines: [],
    totals: { subtotal: 10000, discountTotal: -1000, creditTotal: 0, tax: 0, total: 9000 },
    explanation: { id: "root", rule: "invoice_total", total: 9000, children: [] }
  };

  it("allocates a partial refund proportionally across discounted line items", () => {
    const result = allocateRefund(invoice, 1000, "proportional");

    expect(result.allocations).toEqual([
      { lineItemId: "base", amountMinor: 700 },
      { lineItemId: "usage", amountMinor: 300 }
    ]);
  });

  it("never refunds more than the line total", () => {
    const result = allocateRefund(invoice, 12000, "sequential");

    expect(result.allocations).toEqual([
      { lineItemId: "base", amountMinor: 7000 },
      { lineItemId: "usage", amountMinor: 3000 }
    ]);
    expect(result.creditNote.amountMinor).toBe(10000);
  });
});
