import { describe, expect, it } from "vitest";

import { DEFAULT_COUPONS, DEFAULT_PLANS } from "../src/catalog/defaults.js";
import { MemoryLedgerRepository } from "../src/data/memory.js";
import { scopeRepository } from "../src/data/scoped.js";
import { SqliteLedgerRepository } from "../src/data/sqlite.js";
import { defaultInvoiceEngine } from "../src/engine/InvoiceEngine.js";
import { createSimulationRun } from "../src/simulations/runs.js";
import type { BillingContext } from "../src/engine/context.js";

describe.each([
  ["memory", () => new MemoryLedgerRepository()],
  ["sqlite", () => new SqliteLedgerRepository()]
] as const)("tenant scoped repository: %s", (_name, createRepository) => {
  it("hides plans, coupons, and simulations owned by another tenant", async () => {
    const repository = createRepository();
    const tenantA = scopeRepository(repository, "tenant_a", "user_a");
    const tenantB = scopeRepository(repository, "tenant_b", "user_b");

    try {
      await seedDefaults(tenantA);
      await seedDefaults(tenantB);
      await tenantA.plans.save({
        id: "private_plan",
        name: "Tenant A private plan",
        type: "flat",
        currency: "USD",
        components: [
          {
            id: "base",
            name: "Base",
            type: "flat",
            currency: "USD",
            unitAmountMinor: 5000
          }
        ]
      });
      await tenantA.coupons.save({
        code: "PRIVATE",
        kind: "fixed",
        value: 100,
        stackable: true
      });

      const context = createContext("private_plan", ["PRIVATE"]);
      await tenantA.simulations.save(
        createSimulationRun({
          id: "sim_private",
          name: "Private simulation",
          context,
          invoice: defaultInvoiceEngine.simulate({
            ...context,
            subscription: { ...context.subscription, planId: "starter_monthly" },
            coupons: []
          })
        })
      );

      await expect(tenantA.plans.get("private_plan")).resolves.toMatchObject({
        id: "private_plan"
      });
      await expect(tenantB.plans.get("private_plan")).resolves.toBeUndefined();
      await expect(tenantB.coupons.get("PRIVATE")).resolves.toBeUndefined();
      await expect(tenantB.simulations.get("sim_private")).resolves.toBeUndefined();
      await expect(tenantB.plans.list()).resolves.not.toContainEqual(
        expect.objectContaining({ id: "private_plan" })
      );
      await expect(tenantB.coupons.list()).resolves.not.toContainEqual(
        expect.objectContaining({ code: "PRIVATE" })
      );
      await expect(tenantB.simulations.list()).resolves.toEqual([]);
    } finally {
      repository.close();
    }
  });

  it("scopes usage, customers, subscriptions, transactions, and close", async () => {
    const repository = createRepository();
    const tenantA = scopeRepository(repository, "tenant_a", "user_a");
    const tenantB = scopeRepository(repository, "tenant_b", "user_b");

    await tenantA.transaction(async (scoped) => {
      await scoped.usage.ingest({
        idempotencyKey: "evt_1",
        customerId: "cus_1",
        meter: "api_calls",
        quantity: 2,
        timestamp: "2026-01-01T00:00:00.000Z"
      });
      await scoped.customers.saveCustomer({
        id: "cus_1",
        name: "Tenant A Customer",
        taxProfile: { exempt: false, jurisdiction: "US-NY" },
        metadata: { owner: "finance" }
      });
      await scoped.customers.saveSubscription({
        customerId: "cus_1",
        planId: "starter_monthly",
        seats: 3,
        startsOn: "2026-01-01",
        endsOn: "2026-12-31"
      });
    });

    await expect(tenantA.usage.list()).resolves.toEqual([
      {
        idempotencyKey: "evt_1",
        customerId: "cus_1",
        meter: "api_calls",
        quantity: 2,
        timestamp: "2026-01-01T00:00:00.000Z"
      }
    ]);
    await expect(tenantB.usage.list()).resolves.toEqual([]);
    await expect(tenantA.customers.getCustomer("cus_1")).resolves.toMatchObject({
      id: "cus_1",
      name: "Tenant A Customer"
    });
    await expect(tenantB.customers.getCustomer("cus_1")).resolves.toBeUndefined();
    await expect(tenantA.customers.listCustomers()).resolves.toHaveLength(1);
    await expect(tenantB.customers.listCustomers()).resolves.toEqual([]);
    await expect(tenantA.customers.listSubscriptions("cus_1")).resolves.toEqual([
      {
        customerId: "cus_1",
        planId: "starter_monthly",
        seats: 3,
        startsOn: "2026-01-01",
        endsOn: "2026-12-31"
      }
    ]);
    await expect(tenantA.customers.listSubscriptions()).resolves.toEqual([
      {
        customerId: "cus_1",
        planId: "starter_monthly",
        seats: 3,
        startsOn: "2026-01-01",
        endsOn: "2026-12-31"
      }
    ]);

    await tenantA.close();
  });
});

async function seedDefaults(repository: ReturnType<typeof scopeRepository>): Promise<void> {
  for (const plan of Object.values(DEFAULT_PLANS)) {
    await repository.plans.save(plan);
  }
  for (const coupon of Object.values(DEFAULT_COUPONS)) {
    await repository.coupons.save(coupon);
  }
}

function createContext(planId: string, coupons: string[]): BillingContext {
  return {
    currency: "USD",
    period: { start: "2026-01-01", end: "2026-02-01" },
    customer: { id: "cus_scope", taxProfile: { exempt: true, jurisdiction: "US-CA" } },
    subscription: { planId, seats: 1, changedOn: null },
    usage: [],
    coupons,
    credits: []
  };
}
