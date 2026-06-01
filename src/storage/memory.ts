import type { Coupon } from "../discounts/types.js";
import type { Plan } from "../plans/types.js";
import { validateUsageEvent } from "../usage/usage-store.js";
import type { UsageEvent, UsageIngestResult } from "../usage/types.js";
import type { CouponRepository, PlanRepository, UsageRepository } from "./repository.js";

export class MemoryPlanRepository implements PlanRepository {
  private readonly plans = new Map<string, Plan>();

  public list(): Plan[] {
    return [...this.plans.values()].map((plan) => structuredClone(plan));
  }

  public get(planId: string): Plan | undefined {
    const plan = this.plans.get(planId);
    return plan ? structuredClone(plan) : undefined;
  }

  public save(plan: Plan): void {
    this.plans.set(plan.id, structuredClone(plan));
  }
}

export class MemoryUsageRepository implements UsageRepository {
  private readonly events = new Map<string, UsageEvent>();

  public ingest(event: UsageEvent): UsageIngestResult {
    validateUsageEvent(event);
    if (this.events.has(event.idempotencyKey)) {
      return { accepted: false, reason: "duplicate_idempotency_key" };
    }
    this.events.set(event.idempotencyKey, { ...event });
    return { accepted: true };
  }

  public list(): UsageEvent[] {
    return [...this.events.values()].map((event) => ({ ...event }));
  }
}

export class MemoryCouponRepository implements CouponRepository {
  private readonly coupons = new Map<string, Coupon>();

  public list(): Coupon[] {
    return [...this.coupons.values()].map((coupon) => ({ ...coupon }));
  }

  public get(code: string): Coupon | undefined {
    const coupon = this.coupons.get(code);
    return coupon ? { ...coupon } : undefined;
  }

  public save(coupon: Coupon): void {
    this.coupons.set(coupon.code, { ...coupon });
  }
}
