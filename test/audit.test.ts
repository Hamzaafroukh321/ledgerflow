import { describe, expect, it } from "vitest";

import { auditInvoice, defaultInvoiceEngine, type BillingContext, type Invoice } from "../src/index.js";

describe("invoice audit", () => {
  const context: BillingContext = {
    currency: "USD",
    period: { start: "2025-01-01", end: "2025-02-01" },
    customer: { id: "cus_1", taxProfile: { exempt: true, jurisdiction: "US-CA" } },
    subscription: { planId: "starter_monthly", seats: 1, changedOn: null },
    usage: [],
    coupons: [],
    credits: []
  };

  it("accepts a valid engine invoice", () => {
    const report = auditInvoice(defaultInvoiceEngine.simulate(context));

    expect(report.summary.valid).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it("reports total and trace mismatches", () => {
    const invoice: Invoice = {
      ...defaultInvoiceEngine.simulate(context),
      totals: {
        subtotal: 9999,
        discountTotal: 0,
        creditTotal: 0,
        tax: 0,
        total: 9999
      },
      explanation: { id: "root", rule: "invoice_total", total: 1, children: [] }
    };

    expect(auditInvoice(invoice).issues.map((issue) => issue.code)).toEqual([
      "subtotal_mismatch",
      "invoice_total_mismatch",
      "trace_root_total_mismatch"
    ]);
  });

  it("flags positive discount and credit amounts", () => {
    const invoice: Invoice = {
      ...defaultInvoiceEngine.simulate(context),
      discounts: [{ code: "BAD", amountMinor: 1 }],
      creditsApplied: [{ id: "BAD", amountMinor: 1, phase: "post_tax" }]
    };

    expect(auditInvoice(invoice).issues.map((issue) => issue.code)).toContain(
      "discount_positive_amount"
    );
    expect(auditInvoice(invoice).issues.map((issue) => issue.code)).toContain("credit_positive_amount");
  });
});
