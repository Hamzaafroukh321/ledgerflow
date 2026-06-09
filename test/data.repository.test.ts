import { describe, expect, it } from "vitest";

import { seedDefaultCoupons, seedDefaultPlans } from "../src/catalog/defaults.js";
import { MemoryLedgerRepository } from "../src/data/memory.js";
import { SqliteLedgerRepository } from "../src/data/sqlite.js";
import { defaultInvoiceEngine } from "../src/engine/InvoiceEngine.js";
import { createSimulationRun } from "../src/simulations/runs.js";
import type { LedgerRepository } from "../src/data/repository.js";

describe.each([
  ["memory", () => new MemoryLedgerRepository()],
  ["sqlite", () => new SqliteLedgerRepository()]
] as const)("ledger repository contract: %s", (_name, createRepository) => {
  it("persists catalog, usage, customers, subscriptions, and simulation runs", () => {
    const repository = createRepository();
    try {
      exerciseRepository(repository);
    } finally {
      repository.close();
    }
  });
});

it("rolls back SQLite transactions cleanly", () => {
  const repository = new SqliteLedgerRepository();
  try {
    expect(() =>
      repository.transaction(() => {
        repository.plans.save({
          id: "rolled_back",
          name: "Rolled back",
          type: "flat",
          currency: "USD",
          components: [
            {
              id: "base",
              name: "Base",
              type: "flat",
              currency: "USD",
              unitAmountMinor: 100
            }
          ]
        });
        throw new Error("rollback");
      })
    ).toThrow("rollback");
    expect(repository.plans.get("rolled_back")).toBeUndefined();
  } finally {
    repository.close();
  }
});

it("rejects memory transactions after close", () => {
  const repository = new MemoryLedgerRepository();
  repository.close();

  expect(() => repository.transaction(() => undefined)).toThrow("Repository is closed");
});

it("returns memory transaction results before close", () => {
  const repository = new MemoryLedgerRepository();

  try {
    expect(repository.transaction(() => "committed")).toBe("committed");
  } finally {
    repository.close();
  }
});

function exerciseRepository(repository: LedgerRepository): void {
  seedDefaultPlans(repository.plans);
  seedDefaultCoupons(repository.coupons);

  expect(repository.plans.get("starter_monthly")?.name).toBe("Starter monthly");
  expect(repository.coupons.get("SAVE20")?.value).toBe(20);

  const usage = {
    idempotencyKey: "usage_1",
    customerId: "cus_repo",
    meter: "api_calls",
    quantity: 7,
    timestamp: "2026-01-01T00:00:00.000Z"
  };
  expect(repository.usage.ingest(usage)).toEqual({ accepted: true });
  expect(repository.usage.ingest(usage)).toEqual({
    accepted: false,
    reason: "duplicate_idempotency_key"
  });
  expect(repository.usage.list()).toEqual([usage]);

  const customer = {
    id: "cus_repo",
    name: "Repository Customer",
    taxProfile: { exempt: true, jurisdiction: "US-CA" },
    metadata: { owner: "finance" }
  };
  repository.customers.saveCustomer(customer);
  repository.customers.saveSubscription({
    customerId: "cus_repo",
    planId: "starter_monthly",
    seats: 2,
    startsOn: "2026-01-01"
  });
  expect(repository.customers.getCustomer("cus_repo")).toEqual(customer);
  expect(repository.customers.listSubscriptions("cus_repo")).toHaveLength(1);

  const context = {
    currency: "USD",
    period: { start: "2026-01-01", end: "2026-02-01" },
    customer: { id: "cus_repo", taxProfile: { exempt: true, jurisdiction: "US-CA" } },
    subscription: { planId: "starter_monthly", seats: 2, changedOn: null },
    usage: [],
    coupons: [],
    credits: []
  };
  const run = createSimulationRun({
    id: "sim_repo",
    name: "Repository simulation",
    context,
    invoice: defaultInvoiceEngine.simulate(context)
  });
  repository.simulations.save(run);
  expect(repository.simulations.get("sim_repo")).toEqual(run);
  expect(repository.simulations.list()).toEqual([run]);
}
