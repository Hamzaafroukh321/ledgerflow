import { describe, expect, it } from "vitest";

import {
  DEFAULT_COUPONS,
  DEFAULT_PLANS,
  MemoryCouponRepository,
  MemoryPlanRepository,
  seedDefaultCoupons,
  seedDefaultPlans,
  type Plan
} from "../src/index.js";

describe("default catalog", () => {
  it("contains runnable default plans and coupons", () => {
    expect(Object.keys(DEFAULT_PLANS).sort()).toEqual(["pro_monthly", "starter_monthly"]);
    expect(Object.keys(DEFAULT_COUPONS).sort()).toEqual(["LESS500", "SAVE20"]);
  });

  it("seeds repositories without overwriting existing values", () => {
    const plans = new MemoryPlanRepository();
    const coupons = new MemoryCouponRepository();
    const proPlan = DEFAULT_PLANS.pro_monthly;
    if (!proPlan) {
      throw new Error("Expected default pro plan");
    }
    const customPlan: Plan = {
      ...proPlan,
      name: "Custom Pro"
    };
    plans.save(customPlan);
    coupons.save({ code: "SAVE20", kind: "percent", value: 5, stackable: true });

    seedDefaultPlans(plans);
    seedDefaultCoupons(coupons);

    expect(plans.get("pro_monthly")?.name).toBe("Custom Pro");
    expect(coupons.get("SAVE20")?.value).toBe(5);
    expect(plans.get("starter_monthly")).toBeDefined();
    expect(coupons.get("LESS500")).toBeDefined();
  });
});
