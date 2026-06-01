import type { Coupon } from "../discounts/types.js";
import type { Plan } from "../plans/types.js";
import type { UsageEvent, UsageIngestResult } from "../usage/types.js";

export interface PlanRepository {
  list(): Plan[];
  get(planId: string): Plan | undefined;
  save(plan: Plan): void;
}

export interface UsageRepository {
  ingest(event: UsageEvent): UsageIngestResult;
  list(): UsageEvent[];
}

export interface CouponRepository {
  list(): Coupon[];
  get(code: string): Coupon | undefined;
  save(coupon: Coupon): void;
}
