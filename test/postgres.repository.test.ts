import { newDb } from "pg-mem";
import type { QueryResultRow } from "pg";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_COUPONS, DEFAULT_PLANS } from "../src/catalog/defaults.js";
import { PostgresLedgerRepository } from "../src/data/postgres.js";
import { defaultInvoiceEngine } from "../src/engine/InvoiceEngine.js";
import { createSimulationRun } from "../src/simulations/runs.js";
import type { AsyncLedgerRepository } from "../src/data/repository.js";
import type { BillingContext } from "../src/engine/context.js";

interface PgPool {
  connect(): Promise<{
    query(sql: string, params?: unknown[]): Promise<{ rows: QueryResultRow[] }>;
    release(): void;
  }>;
  end(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: QueryResultRow[] }>;
}

const repositories: PostgresLedgerRepository[] = [];

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.close()));
});

describe("PostgresLedgerRepository", () => {
  it("matches the ledger repository contract", async () => {
    const repository = await createRepository();

    await exerciseRepository(repository);
  });

  it("handles absent records, optional fields, and idempotency conflicts", async () => {
    const repository = await createRepository();

    await expect(repository.plans.get("missing_plan")).resolves.toBeUndefined();
    await expect(repository.coupons.get("missing_coupon")).resolves.toBeUndefined();
    await expect(repository.customers.getCustomer("missing_customer")).resolves.toBeUndefined();
    await expect(repository.simulations.get("missing_run")).resolves.toBeUndefined();

    await repository.coupons.save({
      code: "PROONLY",
      kind: "fixed",
      value: 100,
      redemptionLimit: 3,
      appliesTo: ["pro_monthly"],
      stackable: false,
      redeemedCount: 1
    });
    await expect(repository.coupons.get("PROONLY")).resolves.toEqual({
      code: "PROONLY",
      kind: "fixed",
      value: 100,
      redemptionLimit: 3,
      appliesTo: ["pro_monthly"],
      stackable: false,
      redeemedCount: 1
    });

    await repository.customers.saveCustomer({
      id: "cus_optional",
      name: "Optional Customer",
      email: "billing@example.com",
      taxProfile: { exempt: false, jurisdiction: "US-NY" },
      metadata: {}
    });
    await repository.customers.saveSubscription({
      customerId: "cus_optional",
      planId: "pro_monthly",
      seats: 4,
      startsOn: "2026-01-01",
      endsOn: "2026-12-31"
    });
    await expect(repository.customers.getCustomer("cus_optional")).resolves.toEqual({
      id: "cus_optional",
      name: "Optional Customer",
      email: "billing@example.com",
      taxProfile: { exempt: false, jurisdiction: "US-NY" },
      metadata: {}
    });
    await expect(repository.customers.listSubscriptions()).resolves.toEqual([
      {
        customerId: "cus_optional",
        planId: "pro_monthly",
        seats: 4,
        startsOn: "2026-01-01",
        endsOn: "2026-12-31"
      }
    ]);

    const usage = {
      idempotencyKey: "usage_conflict",
      customerId: "cus_optional",
      meter: "api_calls",
      quantity: 5,
      timestamp: "2026-01-01T00:00:00.000Z"
    };
    await repository.usage.ingest(usage);
    await expect(repository.usage.ingest({ ...usage, quantity: 6 })).resolves.toEqual({
      accepted: false,
      reason: "idempotency_conflict",
      existingEvent: usage
    });
  });

  it("rolls migrations down cleanly", async () => {
    const repository = await createRepository();

    await repository.migrateDown();

    await expect(repository.plans.list()).rejects.toThrow(/plans/i);
  });

  it("rolls back transaction failures before releasing the client", async () => {
    const calls: string[] = [];
    const client = {
      query: async (sql: string): Promise<{ rows: QueryResultRow[] }> => {
        calls.push(sql);
        return { rows: [] };
      },
      release: (): void => {
        calls.push("release");
      }
    };
    const repository = new PostgresLedgerRepository(client, false, {
      connect: async () => client,
      end: async () => undefined
    });

    await expect(
      repository.transaction(async (scoped) => {
        await scoped.plans.save({
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
    ).rejects.toThrow("rollback");

    expect(calls[0]).toBe("BEGIN");
    expect(calls.at(-2)).toBe("ROLLBACK");
    expect(calls.at(-1)).toBe("release");
    expect(calls).not.toContain("COMMIT");
  });

  it("commits successful transactions and skips close for borrowed clients", async () => {
    const calls: string[] = [];
    const client = {
      query: async (sql: string): Promise<{ rows: QueryResultRow[] }> => {
        calls.push(sql);
        return { rows: [] };
      },
      release: (): void => {
        calls.push("release");
      }
    };
    const repository = new PostgresLedgerRepository(client, false, {
      connect: async () => client,
      end: async () => {
        calls.push("end");
      }
    });

    await expect(repository.transaction(async () => "ok")).resolves.toBe("ok");
    await repository.close();

    expect(calls).toEqual(["BEGIN", "COMMIT", "release"]);
  });

  it("runs transactions directly when no pool is attached", async () => {
    const calls: string[] = [];
    const repository = new PostgresLedgerRepository(
      {
        query: async (sql: string): Promise<{ rows: QueryResultRow[] }> => {
          calls.push(sql);
          return { rows: [] };
        }
      },
      false
    );

    await expect(repository.transaction(async () => "direct")).resolves.toBe("direct");

    expect(calls).toEqual([]);
  });

  it("persists concurrent simulation run saves deterministically", async () => {
    const repository = await createRepository();
    const context = createContext();

    await Promise.all(
      Array.from({ length: 12 }, async (_, index) =>
        repository.simulations.save(
          createSimulationRun({
            id: `sim_concurrent_${index.toString().padStart(2, "0")}`,
            name: `Concurrent ${index}`,
            createdAt: `2026-01-01T00:00:${index.toString().padStart(2, "0")}.000Z`,
            context,
            invoice: defaultInvoiceEngine.simulate(context)
          })
        )
      )
    );

    const runs = await repository.simulations.list();
    expect(runs).toHaveLength(12);
    expect(runs.map((run) => run.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `sim_concurrent_${(11 - index).toString().padStart(2, "0")}`)
    );
  });
});

async function createRepository(): Promise<PostgresLedgerRepository> {
  const db = newDb();
  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool() as PgPool;
  const repository = new PostgresLedgerRepository(pool, true, pool);
  repositories.push(repository);
  await repository.migrateUp();
  return repository;
}

async function exerciseRepository(repository: AsyncLedgerRepository): Promise<void> {
  for (const plan of Object.values(DEFAULT_PLANS)) {
    await repository.plans.save(plan);
  }
  for (const coupon of Object.values(DEFAULT_COUPONS)) {
    await repository.coupons.save(coupon);
  }

  expect((await repository.plans.get("starter_monthly"))?.name).toBe("Starter monthly");
  expect((await repository.coupons.get("SAVE20"))?.value).toBe(20);

  const usage = {
    idempotencyKey: "usage_pg_1",
    customerId: "cus_pg",
    meter: "api_calls",
    quantity: 7,
    timestamp: "2026-01-01T00:00:00.000Z"
  };
  await expect(repository.usage.ingest(usage)).resolves.toEqual({ accepted: true });
  await expect(repository.usage.ingest(usage)).resolves.toEqual({
    accepted: false,
    reason: "duplicate_idempotency_key"
  });
  await expect(repository.usage.list()).resolves.toEqual([usage]);

  const customer = {
    id: "cus_pg",
    name: "Postgres Customer",
    taxProfile: { exempt: true, jurisdiction: "US-CA" },
    metadata: { owner: "finance" }
  };
  await repository.customers.saveCustomer(customer);
  await repository.customers.saveSubscription({
    customerId: "cus_pg",
    planId: "starter_monthly",
    seats: 2,
    startsOn: "2026-01-01"
  });
  await expect(repository.customers.getCustomer("cus_pg")).resolves.toEqual(customer);
  await expect(repository.customers.listSubscriptions("cus_pg")).resolves.toHaveLength(1);

  const context = createContext();
  const run = createSimulationRun({
    id: "sim_pg",
    name: "Postgres simulation",
    context,
    invoice: defaultInvoiceEngine.simulate(context)
  });
  await repository.simulations.save(run);
  await expect(repository.simulations.get("sim_pg")).resolves.toEqual(run);
  await expect(repository.simulations.list()).resolves.toEqual([run]);
}

function createContext(): BillingContext {
  return {
    currency: "USD",
    period: { start: "2026-01-01", end: "2026-02-01" },
    customer: { id: "cus_pg", taxProfile: { exempt: true, jurisdiction: "US-CA" } },
    subscription: { planId: "starter_monthly", seats: 2, changedOn: null },
    usage: [],
    coupons: [],
    credits: []
  };
}
