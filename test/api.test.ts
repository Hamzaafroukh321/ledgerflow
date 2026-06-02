import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildServer,
  createDefaultServerDeps,
  AppError,
  MemoryCouponRepository,
  MemoryPlanRepository,
  MemoryUsageRepository,
  SqliteCouponRepository,
  SqliteCustomerRepository,
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

    expect((await server.inject({ method: "GET", url: "/health" })).json()).toEqual({
      status: "ok"
    });
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
          url: "/invoices/audit",
          payload: invoice
        })
      ).json<{ summary: { valid: boolean } }>().summary.valid
    ).toBe(true);

    expect(
      (
        await server.inject({
          method: "POST",
          url: "/scenarios/compare",
          payload: {
            baseline: { name: "basic", context },
            candidates: [
              {
                name: "usage",
                context: {
                  ...context,
                  subscription: { planId: "pro_monthly", seats: 2, changedOn: null }
                }
              }
            ]
          }
        })
      ).json<{ deltas: unknown[] }>().deltas
    ).toHaveLength(1);

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
      (await server.inject({ method: "POST", url: "/usage/events", payload: usagePayload }))
        .statusCode
    ).toBe(200);
    expect(
      (await server.inject({ method: "POST", url: "/usage/events", payload: usagePayload }))
        .statusCode
    ).toBe(409);
    const conflictingUsage = await server.inject({
      method: "POST",
      url: "/usage/events",
      payload: { ...usagePayload, quantity: 2 }
    });
    expect(conflictingUsage.statusCode).toBe(409);
    expect(conflictingUsage.json().reason).toBe("idempotency_conflict");

    const events = (await server.inject({ method: "GET", url: "/usage/events" })).json<unknown[]>();
    expect(events).toHaveLength(1);

    const aggregate = await server.inject({
      method: "POST",
      url: "/usage/aggregate",
      payload: { customerId: "cus_1", period: { start: "2025-01-01", end: "2025-02-01" } }
    });
    expect(aggregate.statusCode).toBe(200);
    expect(aggregate.json()).toEqual({ api: 1 });
    await server.close();
  });

  it("serves OpenAPI JSON and Swagger UI", async () => {
    const server = buildServer();

    const openapi = await server.inject({ method: "GET", url: "/openapi.json" });
    expect(openapi.statusCode).toBe(200);
    expect(openapi.json().info.title).toBe("LedgerFlow API");

    const docs = await server.inject({ method: "GET", url: "/docs" });
    expect(docs.statusCode).toBeLessThan(400);
    await server.close();
  });

  it("does not serve the web app unless static hosting is enabled", async () => {
    const server = buildServer();

    const response = await server.inject({
      method: "GET",
      url: "/",
      headers: { accept: "text/html" }
    });

    expect(response.statusCode).toBe(404);
    await server.close();
  });

  it("serves the web app and keeps API routes available when static hosting is enabled", async () => {
    const webRoot = mkdtempSync(join(tmpdir(), "ledgerflow-web-"));
    writeFileSync(join(webRoot, "index.html"), "<!doctype html><title>LedgerFlow UI</title>");
    const server = buildServer({}, { LEDGERFLOW_SERVE_WEB: "1", LEDGERFLOW_WEB_ROOT: webRoot });

    const root = await server.inject({ method: "GET", url: "/", headers: { accept: "text/html" } });
    const clientRoute = await server.inject({
      method: "GET",
      url: "/simulator",
      headers: { accept: "text/html" }
    });
    const plans = await server.inject({
      method: "GET",
      url: "/plans",
      headers: { accept: "application/json" }
    });

    expect(root.statusCode).toBe(200);
    expect(root.body).toContain("LedgerFlow UI");
    expect(clientRoute.statusCode).toBe(200);
    expect(plans.statusCode).toBe(200);
    expect(plans.json<Plan[]>()).toHaveLength(2);
    await server.close();
    rmSync(webRoot, { recursive: true, force: true });
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

  it("maps typed application errors to the stable envelope", async () => {
    const server = buildServer();
    server.get("/forced-error", async () => {
      throw new AppError("forced_error", "Forced failure", 418, { reason: "test" });
    });

    const response = await server.inject({ method: "GET", url: "/forced-error" });
    expect(response.statusCode).toBe(418);
    expect(response.json()).toEqual({
      error: { code: "forced_error", message: "Forced failure", details: { reason: "test" } }
    });
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

  it("manages customers, subscriptions, and billing profiles", async () => {
    const server = buildServer();
    const customerPayload = {
      id: "cus_api",
      name: "API Customer",
      email: "billing@example.com",
      taxProfile: { exempt: false, jurisdiction: "US-CA" },
      metadata: { owner: "finance" }
    };

    const created = await server.inject({
      method: "POST",
      url: "/customers",
      payload: customerPayload
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject(customerPayload);

    const subscription = await server.inject({
      method: "POST",
      url: "/subscriptions",
      payload: {
        customerId: "cus_api",
        planId: "pro_monthly",
        seats: 5,
        startsOn: "2025-01-01"
      }
    });
    expect(subscription.statusCode).toBe(200);

    const profile = await server.inject({
      method: "GET",
      url: "/customers/cus_api/billing-profile?onDate=2025-01-15"
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json().activeSubscription).toMatchObject({ planId: "pro_monthly", seats: 5 });

    const customers = (await server.inject({ method: "GET", url: "/customers" })).json<unknown[]>();
    expect(customers).toHaveLength(1);
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
    expect(deps.customers).toBeInstanceOf(SqliteCustomerRepository);
    expect(
      deps.plans
        .list()
        .map((plan) => plan.id)
        .sort()
    ).toEqual(["pro_monthly", "starter_monthly"]);
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
    if (deps.customers instanceof SqliteCustomerRepository) {
      deps.customers.close();
    }
  });

  it("persists customer profiles through sqlite-backed API restarts", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ledgerflow-api-db-"));
    const dbPath = join(directory, "ledgerflow.sqlite");
    const first = buildServer({}, { LEDGERFLOW_DB: dbPath });

    const customer = await first.inject({
      method: "POST",
      url: "/customers",
      payload: {
        id: "cus_persisted",
        name: "Persisted Customer",
        email: "billing@example.com",
        taxProfile: { exempt: false, jurisdiction: "US-NY", rates: { city: 0.04 } },
        metadata: { source: "api" }
      }
    });
    expect(customer.statusCode).toBe(200);
    const subscription = await first.inject({
      method: "POST",
      url: "/subscriptions",
      payload: {
        customerId: "cus_persisted",
        planId: "starter_monthly",
        seats: 3,
        startsOn: "2025-01-01"
      }
    });
    expect(subscription.statusCode).toBe(200);
    await first.close();

    const second = buildServer({}, { LEDGERFLOW_DB: dbPath });
    const customers = await second.inject({ method: "GET", url: "/customers" });
    expect(customers.statusCode).toBe(200);
    expect(customers.json()).toEqual([
      {
        id: "cus_persisted",
        name: "Persisted Customer",
        email: "billing@example.com",
        taxProfile: { exempt: false, jurisdiction: "US-NY", rates: { city: 0.04 } },
        metadata: { source: "api" }
      }
    ]);
    const profile = await second.inject({
      method: "GET",
      url: "/customers/cus_persisted/billing-profile?onDate=2025-02-01"
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json().activeSubscription).toMatchObject({
      planId: "starter_monthly",
      seats: 3
    });
    await second.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("uses memory repositories by default", () => {
    const deps = createDefaultServerDeps({});

    expect(deps.plans).toBeInstanceOf(MemoryPlanRepository);
    expect(deps.usage).toBeInstanceOf(MemoryUsageRepository);
    expect(deps.coupons).toBeInstanceOf(MemoryCouponRepository);
  });
});
