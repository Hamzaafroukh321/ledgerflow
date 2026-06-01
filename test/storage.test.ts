import { describe, expect, it } from "vitest";

import {
  MemoryCouponRepository,
  MemoryPlanRepository,
  MemoryUsageRepository,
  SqliteStore,
  type Plan
} from "../src/index.js";

describe("storage", () => {
  const plan: Plan = {
    id: "pro",
    name: "Pro",
    type: "flat",
    currency: "USD",
    components: [{ id: "base", name: "Base", type: "flat", currency: "USD", unitAmountMinor: 1000 }]
  };

  it("memory repositories satisfy the contract", () => {
    const plans = new MemoryPlanRepository();
    const usage = new MemoryUsageRepository();
    const coupons = new MemoryCouponRepository();

    plans.save(plan);
    coupons.save({ code: "SAVE", kind: "percent", value: 10, stackable: true });

    expect(plans.get("pro")).toEqual(plan);
    expect(coupons.get("SAVE")?.value).toBe(10);
    expect(
      usage.ingest({
        idempotencyKey: "evt_1",
        customerId: "cus_1",
        meter: "api",
        quantity: 1,
        timestamp: "2025-01-01T00:00:00Z"
      })
    ).toEqual({ accepted: true });
    expect(
      usage.ingest({
        idempotencyKey: "evt_1",
        customerId: "cus_1",
        meter: "api",
        quantity: 1,
        timestamp: "2025-01-01T00:00:00Z"
      })
    ).toEqual({ accepted: false, reason: "duplicate_idempotency_key" });
  });

  it("sqlite repositories satisfy the same contract", () => {
    const store = new SqliteStore();
    store.save(plan);
    store.save({ code: "SAVE", kind: "fixed", value: 500, stackable: false });

    expect(store.get("pro")).toMatchObject({ id: "pro", name: "Pro" });
    expect(store.get("SAVE")).toMatchObject({ code: "SAVE", value: 500 });
    expect(
      store.ingest({
        idempotencyKey: "evt_1",
        customerId: "cus_1",
        meter: "api",
        quantity: 1,
        timestamp: "2025-01-01T00:00:00Z"
      })
    ).toEqual({ accepted: true });
    expect(
      store.ingest({
        idempotencyKey: "evt_1",
        customerId: "cus_1",
        meter: "api",
        quantity: 1,
        timestamp: "2025-01-01T00:00:00Z"
      })
    ).toEqual({ accepted: false, reason: "duplicate_idempotency_key" });
    store.close();
  });
});
