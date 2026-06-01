import type { Coupon } from "../discounts/types.js";
import type { Plan } from "../plans/types.js";
import type { CouponRepository, PlanRepository } from "../storage/repository.js";

export const DEFAULT_PLANS: Record<string, Plan> = {
  pro_monthly: {
    id: "pro_monthly",
    name: "Pro monthly",
    type: "per_seat",
    currency: "USD",
    components: [
      {
        id: "pro_seats",
        name: "Pro plan",
        type: "per_seat",
        currency: "USD",
        unitAmountMinor: 1999
      },
      {
        id: "api_calls",
        name: "API usage overage",
        type: "usage",
        currency: "USD",
        unitAmountMinor: 1,
        meter: "api_calls",
        includedQuantity: 10000
      }
    ]
  },
  starter_monthly: {
    id: "starter_monthly",
    name: "Starter monthly",
    type: "flat",
    currency: "USD",
    components: [
      {
        id: "starter_base",
        name: "Starter plan",
        type: "flat",
        currency: "USD",
        unitAmountMinor: 2900
      }
    ]
  }
};

export const DEFAULT_COUPONS: Record<string, Coupon> = {
  SAVE20: { code: "SAVE20", kind: "percent", value: 20, stackable: true },
  LESS500: { code: "LESS500", kind: "fixed", value: 500, stackable: true }
};

export function seedDefaultPlans(repository: PlanRepository): void {
  for (const plan of Object.values(DEFAULT_PLANS)) {
    if (!repository.get(plan.id)) {
      repository.save(plan);
    }
  }
}

export function seedDefaultCoupons(repository: CouponRepository): void {
  for (const coupon of Object.values(DEFAULT_COUPONS)) {
    if (!repository.get(coupon.code)) {
      repository.save(coupon);
    }
  }
}
