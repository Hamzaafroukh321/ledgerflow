import { describe, expect, it } from "vitest";

import { createLineItem, reconcile, traceNode } from "../src/index.js";

describe("invoice traces", () => {
  it("reconciles trace leaves to the invoice total", () => {
    const trace = traceNode({
      id: "root",
      rule: "invoice_total",
      total: 9756,
      children: [
        traceNode({ id: "subtotal", rule: "subtotal", total: 11995 }),
        traceNode({ id: "discounts", rule: "discounts", total: -2399 }),
        traceNode({ id: "credits", rule: "credits", total: -500 }),
        traceNode({ id: "tax", rule: "tax", total: 660 })
      ]
    });

    expect(reconcile(trace)).toBe(true);
  });

  it("creates line items with stable trace identifiers", () => {
    expect(
      createLineItem({ id: "base", description: "Base", amountMinor: 1000, currency: "USD" })
    ).toEqual({
      id: "base",
      description: "Base",
      amountMinor: 1000,
      currency: "USD",
      traceId: "trace-base"
    });
  });
});
