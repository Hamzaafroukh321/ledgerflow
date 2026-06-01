import { describe, expect, it } from "vitest";

import { compareScenarios, type BillingContext } from "../src/index.js";

describe("scenario comparison", () => {
  const baseline: BillingContext = {
    currency: "USD",
    period: { start: "2025-01-01", end: "2025-02-01" },
    customer: { id: "cus_1", taxProfile: { exempt: true, jurisdiction: "US-CA" } },
    subscription: { planId: "starter_monthly", seats: 1, changedOn: null },
    usage: [],
    coupons: [],
    credits: []
  };

  it("compares a baseline invoice with candidate scenarios", () => {
    const comparison = compareScenarios(
      { name: "starter", context: baseline },
      [
        {
          name: "pro",
          context: {
            ...baseline,
            subscription: { planId: "pro_monthly", seats: 2, changedOn: null }
          }
        }
      ]
    );

    expect(comparison.baseline.audit.summary.valid).toBe(true);
    expect(comparison.candidates[0]?.audit.summary.valid).toBe(true);
    expect(comparison.deltas).toEqual([
      {
        from: "starter",
        to: "pro",
        subtotalDelta: 1098,
        discountDelta: 0,
        creditDelta: 0,
        taxDelta: 0,
        totalDelta: 1098
      }
    ]);
  });

  it("requires at least one candidate", () => {
    expect(() => compareScenarios({ name: "starter", context: baseline }, [])).toThrow(/candidate/);
  });
});
