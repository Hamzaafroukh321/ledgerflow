import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createCustomer,
  MemoryCouponRepository,
  MemoryPlanRepository,
  MemorySimulationRunRepository,
  MemoryUsageRepository,
  SqliteCouponRepository,
  SqliteCustomerRepository,
  SqlitePlanRepository,
  SqliteSimulationRunRepository,
  SqliteStore,
  SqliteUsageRepository,
  assignSubscription,
  createSimulationRun,
  defaultInvoiceEngine,
  type BillingContext,
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

  const context: BillingContext = {
    currency: "USD",
    period: { start: "2025-01-01", end: "2025-02-01" },
    customer: { id: "cus_1", taxProfile: { exempt: true, jurisdiction: "US-CA" } },
    subscription: { planId: "starter_monthly", seats: 1, changedOn: null },
    usage: [],
    coupons: [],
    credits: []
  };

  it("memory repositories satisfy the contract", () => {
    const plans = new MemoryPlanRepository();
    const usage = new MemoryUsageRepository();
    const coupons = new MemoryCouponRepository();
    const simulations = new MemorySimulationRunRepository();

    plans.save(plan);
    coupons.save({ code: "SAVE", kind: "percent", value: 10, stackable: true });
    const run = createSimulationRun({
      id: "sim_1",
      name: "January run",
      createdAt: "2025-01-01T00:00:00.000Z",
      context,
      invoice: defaultInvoiceEngine.simulate(context)
    });
    simulations.save(run);

    expect(plans.get("pro")).toEqual(plan);
    expect(coupons.get("SAVE")?.value).toBe(10);
    expect(simulations.get("sim_1")).toEqual(run);
    expect(simulations.list()).toEqual([run]);
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
    expect(
      usage.ingest({
        idempotencyKey: "evt_1",
        customerId: "cus_1",
        meter: "api",
        quantity: 2,
        timestamp: "2025-01-01T00:00:00Z"
      })
    ).toMatchObject({ accepted: false, reason: "idempotency_conflict" });
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
    expect(
      store.ingest({
        idempotencyKey: "evt_1",
        customerId: "cus_1",
        meter: "api",
        quantity: 2,
        timestamp: "2025-01-01T00:00:00Z"
      })
    ).toMatchObject({ accepted: false, reason: "idempotency_conflict" });
    store.close();
  });

  it("provides typed sqlite repository adapters", () => {
    const plans = new SqlitePlanRepository();
    const coupons = new SqliteCouponRepository();
    const usage = new SqliteUsageRepository();
    const simulations = new SqliteSimulationRunRepository();

    plans.save(plan);
    coupons.save({
      code: "TARGET",
      kind: "fixed",
      value: 100,
      appliesTo: ["base"],
      redemptionLimit: 2,
      stackable: true
    });
    const event = {
      idempotencyKey: "evt_adapter",
      customerId: "cus_1",
      meter: "api",
      quantity: 3,
      timestamp: "2025-01-01T00:00:00Z"
    };

    expect(plans.list()).toEqual([plan]);
    expect(coupons.list()).toEqual([
      {
        code: "TARGET",
        kind: "fixed",
        value: 100,
        appliesTo: ["base"],
        redemptionLimit: 2,
        redeemedCount: 0,
        stackable: true
      }
    ]);
    expect(usage.ingest(event)).toEqual({ accepted: true });
    expect(usage.list()).toEqual([event]);
    const run = createSimulationRun({
      id: "sim_adapter",
      name: "Adapter run",
      createdAt: "2025-01-01T00:00:00.000Z",
      context,
      invoice: defaultInvoiceEngine.simulate(context)
    });
    simulations.save(run);
    expect(simulations.list()).toEqual([run]);
    expect(simulations.get("sim_adapter")).toEqual(run);

    plans.close();
    coupons.close();
    usage.close();
    simulations.close();
  });

  it("persists customers and subscriptions across sqlite repository instances", () => {
    const directory = mkdtempSync(join(tmpdir(), "ledgerflow-customers-"));
    const dbPath = join(directory, "ledgerflow.sqlite");
    const first = new SqliteCustomerRepository(dbPath);
    const customer = createCustomer({
      id: "cus_sqlite",
      name: "SQLite Customer",
      email: "billing@example.com",
      taxProfile: {
        exempt: false,
        jurisdiction: "US-CA",
        reverseCharge: true,
        rates: { state: 0.0825 }
      },
      metadata: { segment: "enterprise" }
    });
    const active = assignSubscription({
      customerId: "cus_sqlite",
      planId: "pro_monthly",
      seats: 7,
      startsOn: "2025-01-01"
    });
    const replaced = assignSubscription({
      customerId: "cus_sqlite",
      planId: "pro_monthly",
      seats: 9,
      startsOn: "2025-01-01",
      endsOn: "2025-06-01"
    });

    first.saveCustomer(customer);
    first.saveSubscription(active);
    first.saveSubscription(replaced);
    first.close();

    const second = new SqliteCustomerRepository(dbPath);
    expect(second.getCustomer("cus_sqlite")).toEqual(customer);
    expect(second.listCustomers()).toEqual([customer]);
    expect(second.listSubscriptions("cus_sqlite")).toEqual([replaced]);
    expect(second.listSubscriptions()).toEqual([replaced]);
    second.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("persists simulation runs across sqlite repository instances", () => {
    const directory = mkdtempSync(join(tmpdir(), "ledgerflow-simulations-"));
    const dbPath = join(directory, "ledgerflow.sqlite");
    const older = createSimulationRun({
      id: "sim_old",
      name: "Older run",
      createdAt: "2025-01-01T00:00:00.000Z",
      context,
      invoice: defaultInvoiceEngine.simulate(context)
    });
    const newer = createSimulationRun({
      id: "sim_new",
      name: "Newer run",
      createdAt: "2025-01-02T00:00:00.000Z",
      context: { ...context, invoiceId: "inv_new" },
      invoice: defaultInvoiceEngine.simulate({ ...context, invoiceId: "inv_new" })
    });

    const first = new SqliteSimulationRunRepository(dbPath);
    first.save(older);
    first.save(newer);
    first.close();

    const second = new SqliteSimulationRunRepository(dbPath);
    expect(second.list()).toEqual([newer, older]);
    expect(second.get("sim_old")).toEqual(older);
    second.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
