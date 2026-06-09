import { describe, expect, it } from "vitest";

import { billingContextSchema, invoiceSchema } from "./schemas";
import { flattenTrace } from "./traceTree";

const context = {
  currency: "USD",
  period: { start: "2026-01-01", end: "2026-02-01" },
  customer: { id: "cus_1", taxProfile: { exempt: false, jurisdiction: "US-CA" } },
  subscription: { planId: "pro_monthly", seats: 2 },
  usage: [{ meter: "api_calls", quantity: 1200 }],
  coupons: ["SAVE20"],
  credits: [{ id: "cr_1", amountMinor: 100, phase: "pre_tax" }]
};

describe("schemas", () => {
  it("accepts a valid billing context", () => {
    expect(billingContextSchema.parse(context).currency).toBe("USD");
  });

  it("rejects invalid currency codes", () => {
    expect(() => billingContextSchema.parse({ ...context, currency: "usd" })).toThrow();
  });

  it("parses recursive invoice traces", () => {
    const invoice = invoiceSchema.parse({
      currency: "USD",
      lineItems: [{ id: "base", description: "Base", amountMinor: 1000, currency: "USD", traceId: "t1" }],
      discounts: [],
      creditsApplied: [],
      taxLines: [],
      totals: { subtotal: 1000, discountTotal: 0, creditTotal: 0, tax: 0, total: 1000 },
      explanation: {
        id: "root",
        rule: "invoice_total",
        total: 1000,
        children: [{ id: "subtotal", rule: "subtotal", total: 1000, children: [] }]
      }
    });

    expect(invoice.explanation.children[0]?.rule).toBe("subtotal");
  });

  it("flattens trace leaves with missing children", () => {
    const leafWithoutChildren = { id: "root", rule: "leaf", total: 1 } as unknown as Parameters<
      typeof flattenTrace
    >[0];

    expect(flattenTrace(leafWithoutChildren)).toEqual([
      { id: "root", rule: "leaf", total: 1, depth: 0 }
    ]);
  });
});
