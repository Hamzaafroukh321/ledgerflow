import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildServer,
  createDefaultServerDeps,
  AppError,
  MemoryCouponRepository,
  MemoryLedgerRepository,
  MemoryPlanRepository,
  PostgresLedgerRepository,
  SqliteLedgerRepository,
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

  it("requires a configured API token on operational routes", async () => {
    const webRoot = mkdtempSync(join(tmpdir(), "ledgerflow-web-"));
    writeFileSync(join(webRoot, "index.html"), "<!doctype html><title>LedgerFlow UI</title>");
    const server = buildServer(
      {},
      {
        LEDGERFLOW_API_TOKEN: "fixture-token",
        LEDGERFLOW_SERVE_WEB: "1",
        LEDGERFLOW_WEB_ROOT: webRoot
      }
    );

    const health = await server.inject({ method: "GET", url: "/health" });
    const docs = await server.inject({ method: "GET", url: "/docs" });
    const webRoute = await server.inject({
      method: "GET",
      url: "/plans",
      headers: { accept: "text/html" }
    });
    const missingToken = await server.inject({
      method: "GET",
      url: "/plans",
      headers: { accept: "application/json" }
    });
    const wrongToken = await server.inject({
      method: "GET",
      url: "/plans",
      headers: { "x-ledgerflow-token": "wrong" }
    });
    const bearerToken = await server.inject({
      method: "GET",
      url: "/plans",
      headers: { authorization: "Bearer fixture-token" }
    });
    const headerToken = await server.inject({
      method: "POST",
      url: "/invoices/simulate",
      headers: { "x-ledgerflow-token": "fixture-token" },
      payload: context
    });

    expect(health.statusCode).toBe(200);
    expect(docs.statusCode).toBeLessThan(400);
    expect(webRoute.statusCode).toBe(200);
    expect(webRoute.body).toContain("LedgerFlow UI");
    expect(missingToken.statusCode).toBe(401);
    expect(missingToken.json()).toEqual({
      error: {
        code: "unauthorized",
        message: "A valid LedgerFlow API token is required."
      }
    });
    expect(wrongToken.statusCode).toBe(401);
    expect(bearerToken.statusCode).toBe(200);
    expect(headerToken.statusCode).toBe(200);

    await server.close();
    rmSync(webRoot, { recursive: true, force: true });
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
    const overlappingPlansRoute = await server.inject({
      method: "GET",
      url: "/plans",
      headers: { accept: "text/html" }
    });
    const overlappingCustomersRoute = await server.inject({
      method: "GET",
      url: "/customers",
      headers: { accept: "text/html" }
    });
    const overlappingSimulationsRoute = await server.inject({
      method: "GET",
      url: "/simulations",
      headers: { accept: "text/html" }
    });
    const plans = await server.inject({
      method: "GET",
      url: "/plans",
      headers: { accept: "application/json" }
    });
    const simulations = await server.inject({
      method: "GET",
      url: "/simulations",
      headers: { accept: "application/json" }
    });

    expect(root.statusCode).toBe(200);
    expect(root.body).toContain("LedgerFlow UI");
    expect(clientRoute.statusCode).toBe(200);
    expect(overlappingPlansRoute.body).toContain("LedgerFlow UI");
    expect(overlappingCustomersRoute.body).toContain("LedgerFlow UI");
    expect(overlappingSimulationsRoute.body).toContain("LedgerFlow UI");
    expect(plans.statusCode).toBe(200);
    expect(plans.json<Plan[]>()).toHaveLength(2);
    expect(simulations.statusCode).toBe(200);
    expect(simulations.json<unknown[]>()).toEqual([]);
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

  it("creates custom catalog plans and uses them for simulation", async () => {
    const server = buildServer();
    const customPlan: Plan = {
      id: "enterprise_annual",
      name: "Enterprise Annual",
      type: "per_seat",
      currency: "USD",
      components: [
        {
          id: "seat",
          name: "Seat",
          type: "per_seat",
          currency: "USD",
          unitAmountMinor: 120000
        }
      ]
    };

    const created = await server.inject({ method: "POST", url: "/plans", payload: customPlan });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toEqual(customPlan);

    const plans = (await server.inject({ method: "GET", url: "/plans" })).json<Plan[]>();
    expect(plans.map((plan) => plan.id)).toContain("enterprise_annual");

    const simulated = await server.inject({
      method: "POST",
      url: "/invoices/simulate",
      payload: {
        ...context,
        subscription: { planId: "enterprise_annual", seats: 2, changedOn: null }
      }
    });
    expect(simulated.statusCode).toBe(200);
    expect(simulated.json<Invoice>().totals.subtotal).toBe(240000);
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

  it("creates, lists, and retrieves saved simulation runs", async () => {
    const server = buildServer();
    const created = await server.inject({
      method: "POST",
      url: "/simulations",
      payload: {
        id: "sim_api",
        name: "API simulation",
        context
      }
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      id: "sim_api",
      name: "API simulation",
      context,
      invoice: { totals: { total: 2900 } }
    });
    expect(typeof created.json().createdAt).toBe("string");

    const list = await server.inject({ method: "GET", url: "/simulations" });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
    expect(list.json()[0]).toMatchObject({ id: "sim_api", invoice: { totals: { total: 2900 } } });

    const fetched = await server.inject({ method: "GET", url: "/simulations/sim_api" });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toEqual(created.json());

    const missing = await server.inject({ method: "GET", url: "/simulations/missing" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("not_found");
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

    expect(deps.repository).toBeInstanceOf(SqliteLedgerRepository);
    expect(
      deps.plans
        .list()
        .map((plan) => plan.id)
        .sort()
    ).toEqual(["pro_monthly", "starter_monthly"]);
    expect(deps.coupons.get("SAVE20")).toMatchObject({ code: "SAVE20", value: 20 });
    deps.repository.close();
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

    expect(deps.repository).toBeInstanceOf(MemoryLedgerRepository);
  });

  it("selects postgres repositories when LEDGERFLOW_DB_URL is configured", async () => {
    const deps = createDefaultServerDeps({ LEDGERFLOW_DB_URL: "postgres://localhost/ledgerflow" });

    expect(deps.repository).toBeInstanceOf(PostgresLedgerRepository);
    await deps.repository.close();
  });
});
