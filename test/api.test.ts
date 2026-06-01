import { describe, expect, it } from "vitest";

import {
  buildServer,
  createDefaultServerDeps,
  MemoryCouponRepository,
  MemoryPlanRepository,
  MemoryUsageRepository,
  SqliteCouponRepository,
  SqlitePlanRepository,
  SqliteUsageRepository,
  type BillingContext,
  type Invoice,
  type Plan
} from "../src/index.js";

describe("api", () => {
  const context: BillingContext = {
    currency: "USD",
    period: { start: "2025-01-01", end: "2025-02-01" },
    customer: { id: "cus_1", taxProfile: { exempt: true, jurisdiction: "US-CA" } },
    subscription: { planId: "starter_monthly", seats: 1, changedOn: null },
    usage: [],
    coupons: [],
    credits: []
  };

  it("serves health, plans, invoice simulation, coupons, refunds, and usage", async () => {
    const plans = new MemoryPlanRepository();
    const coupons = new MemoryCouponRepository();
    const plan: Plan = {
      id: "visible",
      name: "Visible",
      type: "flat",
      currency: "USD",
      components: [{ id: "base", name: "Base", type: "flat", currency: "USD", unitAmountMinor: 1 }]
    };
    plans.save(plan);
    coupons.save({ code: "SAVE", kind: "percent", value: 10, stackable: true });
    const server = buildServer({ plans, coupons });

    expect((await server.inject({ method: "GET", url: "/health" })).json()).toEqual({ status: "ok" });
    expect((await server.inject({ method: "GET", url: "/plans" })).json()).toEqual([plan]);

    const invoiceResponse = await server.inject({
      method: "POST",
      url: "/invoices/simulate",
      payload: context
    });
    expect(invoiceResponse.statusCode).toBe(200);
    const invoice = invoiceResponse.json<Invoice>();
    expect(invoice.totals.total).toBe(2900);

    expect(
      (
        await server.inject({
          method: "POST",
          url: "/coupons/validate",
          payload: { code: "SAVE", context: {} }
        })
      ).json()
    ).toEqual({ valid: true });

    expect(
      (
        await server.inject({
          method: "POST",
          url: "/refunds/simulate",
          payload: { invoice, amountMinor: 1000, strategy: "sequential" }
        })
      ).json<{ creditNote: { amountMinor: number } }>().creditNote.amountMinor
    ).toBe(1000);

    const usagePayload = {
      idempotencyKey: "evt_1",
      customerId: "cus_1",
      meter: "api",
      quantity: 1,
      timestamp: "2025-01-01T00:00:00Z"
    };
    expect(
      (await server.inject({ method: "POST", url: "/usage/events", payload: usagePayload })).statusCode
    ).toBe(200);
    expect(
      (await server.inject({ method: "POST", url: "/usage/events", payload: usagePayload })).statusCode
    ).toBe(409);
    const conflictingUsage = await server.inject({
      method: "POST",
      url: "/usage/events",
      payload: { ...usagePayload, quantity: 2 }
    });
    expect(conflictingUsage.statusCode).toBe(409);
    expect(conflictingUsage.json().reason).toBe("idempotency_conflict");
    await server.close();
  });

  it("exposes default plans and coupons on a fresh server", async () => {
    const server = buildServer();

    const plans = (await server.inject({ method: "GET", url: "/plans" })).json<Plan[]>();
    expect(plans.map((plan) => plan.id).sort()).toEqual(["pro_monthly", "starter_monthly"]);

    const couponResponse = await server.inject({
      method: "POST",
      url: "/coupons/validate",
      payload: { code: "SAVE20", context: {} }
    });
    expect(couponResponse.statusCode).toBe(200);
    expect(couponResponse.json()).toEqual({ valid: true });
    await server.close();
  });

  it("returns validation 400", async () => {
    const server = buildServer();
    const response = await server.inject({ method: "POST", url: "/usage/events", payload: {} });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
    await server.close();
  });

  it("maps expected domain errors to typed HTTP responses", async () => {
    const server = buildServer();

    const missingPlan = await server.inject({
      method: "POST",
      url: "/invoices/simulate",
      payload: {
        ...context,
        subscription: { planId: "missing", seats: 1, changedOn: null }
      }
    });
    expect(missingPlan.statusCode).toBe(404);
    expect(missingPlan.json().error.code).toBe("not_found");

    const invalidRefund = await server.inject({
      method: "POST",
      url: "/refunds/simulate",
      payload: { invoice: { ...context }, amountMinor: -1, strategy: "sequential" }
    });
    expect(invalidRefund.statusCode).toBe(400);
    expect(invalidRefund.json().error.code).toBe("validation_error");
    await server.close();
  });

  it("validates refund invoice shape before allocation", async () => {
    const server = buildServer();
    const response = await server.inject({
      method: "POST",
      url: "/refunds/simulate",
      payload: { invoice: { currency: "USD" }, amountMinor: 100, strategy: "sequential" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
    await server.close();
  });

  it("uses sqlite repositories when LEDGERFLOW_DB is configured", () => {
    const deps = createDefaultServerDeps({ LEDGERFLOW_DB: ":memory:" });

    expect(deps.plans).toBeInstanceOf(SqlitePlanRepository);
    expect(deps.usage).toBeInstanceOf(SqliteUsageRepository);
    expect(deps.coupons).toBeInstanceOf(SqliteCouponRepository);
    expect(deps.plans.list().map((plan) => plan.id).sort()).toEqual(["pro_monthly", "starter_monthly"]);
    expect(deps.coupons.get("SAVE20")).toMatchObject({ code: "SAVE20", value: 20 });
    if (deps.plans instanceof SqlitePlanRepository) {
      deps.plans.close();
    }
    if (deps.usage instanceof SqliteUsageRepository) {
      deps.usage.close();
    }
    if (deps.coupons instanceof SqliteCouponRepository) {
      deps.coupons.close();
    }
  });

  it("uses memory repositories by default", () => {
    const deps = createDefaultServerDeps({});

    expect(deps.plans).toBeInstanceOf(MemoryPlanRepository);
    expect(deps.usage).toBeInstanceOf(MemoryUsageRepository);
    expect(deps.coupons).toBeInstanceOf(MemoryCouponRepository);
  });
});
