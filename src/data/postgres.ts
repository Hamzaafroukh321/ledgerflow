import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Pool, type QueryResultRow } from "pg";

import type { Customer, SubscriptionAssignment } from "../customers/types.js";
import type { Coupon } from "../discounts/types.js";
import type { Plan } from "../plans/types.js";
import type { SimulationRun } from "../simulations/types.js";
import { sameUsageEvent, validateUsageEvent } from "../usage/usage-store.js";
import type { UsageEvent, UsageIngestResult } from "../usage/types.js";
import type { AsyncLedgerRepository } from "./repository.js";

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: QueryResultRow[] }>;
}

interface TransactionClient extends Queryable {
  release(): void;
}

interface TransactionPool {
  connect(): Promise<TransactionClient>;
  end(): Promise<void>;
}

export class PostgresLedgerRepository implements AsyncLedgerRepository {
  private readonly ownsPool: boolean;

  public constructor(
    private readonly db: Queryable,
    ownsPool = true,
    private readonly pool?: TransactionPool
  ) {
    this.ownsPool = ownsPool;
  }

  public static fromUrl(connectionString: string): PostgresLedgerRepository {
    const pool = new Pool({ connectionString });
    return new PostgresLedgerRepository(pool, true, pool);
  }

  public readonly plans = {
    list: async (): Promise<Plan[]> => {
      const result = await this.db.query(
        "SELECT id, name, type, currency, components_json FROM plans ORDER BY id"
      );
      return result.rows.map(planFromRow);
    },
    get: async (planId: string): Promise<Plan | undefined> => {
      const result = await this.db.query(
        "SELECT id, name, type, currency, components_json FROM plans WHERE id = $1",
        [planId]
      );
      return result.rows[0] ? planFromRow(result.rows[0]) : undefined;
    },
    save: async (plan: Plan): Promise<void> => {
      await this.db.query(
        `INSERT INTO plans (id, name, type, currency, components_json)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           type = EXCLUDED.type,
           currency = EXCLUDED.currency,
           components_json = EXCLUDED.components_json`,
        [plan.id, plan.name, plan.type, plan.currency, JSON.stringify(plan.components)]
      );
    }
  };

  public readonly coupons = {
    list: async (): Promise<Coupon[]> => {
      const result = await this.db.query(
        "SELECT code, kind, value, redemption_limit, applies_to, stackable, redeemed_count FROM coupons ORDER BY code"
      );
      return result.rows.map(couponFromRow);
    },
    get: async (code: string): Promise<Coupon | undefined> => {
      const result = await this.db.query(
        "SELECT code, kind, value, redemption_limit, applies_to, stackable, redeemed_count FROM coupons WHERE code = $1",
        [code]
      );
      return result.rows[0] ? couponFromRow(result.rows[0]) : undefined;
    },
    save: async (coupon: Coupon): Promise<void> => {
      await this.db.query(
        `INSERT INTO coupons (code, kind, value, redemption_limit, applies_to, stackable, redeemed_count)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         ON CONFLICT (code) DO UPDATE SET
           kind = EXCLUDED.kind,
           value = EXCLUDED.value,
           redemption_limit = EXCLUDED.redemption_limit,
           applies_to = EXCLUDED.applies_to,
           stackable = EXCLUDED.stackable,
           redeemed_count = EXCLUDED.redeemed_count`,
        [
          coupon.code,
          coupon.kind,
          coupon.value,
          coupon.redemptionLimit ?? null,
          coupon.appliesTo ? JSON.stringify(coupon.appliesTo) : null,
          coupon.stackable,
          coupon.redeemedCount ?? 0
        ]
      );
    }
  };

  public readonly usage = {
    ingest: async (event: UsageEvent): Promise<UsageIngestResult> => {
      validateUsageEvent(event);
      const existing = await this.getUsageEvent(event.idempotencyKey);
      if (existing) {
        return sameUsageEvent(existing, event)
          ? { accepted: false, reason: "duplicate_idempotency_key" }
          : { accepted: false, reason: "idempotency_conflict", existingEvent: existing };
      }
      await this.db.query(
        "INSERT INTO usage_events (idempotency_key, customer_id, meter, quantity, ts) VALUES ($1, $2, $3, $4, $5)",
        [event.idempotencyKey, event.customerId, event.meter, event.quantity, event.timestamp]
      );
      return { accepted: true };
    },
    list: async (): Promise<UsageEvent[]> => {
      const result = await this.db.query(
        "SELECT idempotency_key, customer_id, meter, quantity, ts FROM usage_events ORDER BY ts"
      );
      return result.rows.map(usageFromRow);
    }
  };

  public readonly customers = {
    listCustomers: async (): Promise<Customer[]> => {
      const result = await this.db.query(
        "SELECT id, name, email, tax_profile_json, metadata_json FROM customers ORDER BY id"
      );
      return result.rows.map(customerFromRow);
    },
    getCustomer: async (customerId: string): Promise<Customer | undefined> => {
      const result = await this.db.query(
        "SELECT id, name, email, tax_profile_json, metadata_json FROM customers WHERE id = $1",
        [customerId]
      );
      return result.rows[0] ? customerFromRow(result.rows[0]) : undefined;
    },
    saveCustomer: async (customer: Customer): Promise<void> => {
      await this.db.query(
        `INSERT INTO customers (id, name, email, tax_profile_json, metadata_json)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           tax_profile_json = EXCLUDED.tax_profile_json,
           metadata_json = EXCLUDED.metadata_json`,
        [
          customer.id,
          customer.name,
          customer.email ?? null,
          JSON.stringify(customer.taxProfile),
          JSON.stringify(customer.metadata ?? {})
        ]
      );
    },
    listSubscriptions: async (customerId?: string): Promise<SubscriptionAssignment[]> => {
      const result = customerId
        ? await this.db.query(
            "SELECT customer_id, plan_id, seats, starts_on, ends_on FROM subscriptions WHERE customer_id = $1 ORDER BY starts_on, plan_id",
            [customerId]
          )
        : await this.db.query(
            "SELECT customer_id, plan_id, seats, starts_on, ends_on FROM subscriptions ORDER BY customer_id, starts_on, plan_id"
          );
      return result.rows.map(subscriptionFromRow);
    },
    saveSubscription: async (assignment: SubscriptionAssignment): Promise<void> => {
      await this.db.query(
        `INSERT INTO subscriptions (customer_id, plan_id, starts_on, seats, ends_on)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (customer_id, plan_id, starts_on) DO UPDATE SET
           seats = EXCLUDED.seats,
           ends_on = EXCLUDED.ends_on`,
        [
          assignment.customerId,
          assignment.planId,
          assignment.startsOn,
          assignment.seats,
          assignment.endsOn ?? null
        ]
      );
    }
  };

  public readonly simulations = {
    list: async (): Promise<SimulationRun[]> => {
      const result = await this.db.query(
        "SELECT id, name, created_at, context_json, invoice_json FROM simulation_runs ORDER BY created_at DESC, id"
      );
      return result.rows.map(simulationFromRow);
    },
    get: async (runId: string): Promise<SimulationRun | undefined> => {
      const result = await this.db.query(
        "SELECT id, name, created_at, context_json, invoice_json FROM simulation_runs WHERE id = $1",
        [runId]
      );
      return result.rows[0] ? simulationFromRow(result.rows[0]) : undefined;
    },
    save: async (run: SimulationRun): Promise<void> => {
      await this.db.query(
        `INSERT INTO simulation_runs (id, name, created_at, context_json, invoice_json)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           created_at = EXCLUDED.created_at,
           context_json = EXCLUDED.context_json,
           invoice_json = EXCLUDED.invoice_json`,
        [run.id, run.name, run.createdAt, JSON.stringify(run.context), JSON.stringify(run.invoice)]
      );
    }
  };

  public async migrateUp(): Promise<void> {
    await this.db.query(readMigration("001_initial.up.sql"));
  }

  public async migrateDown(): Promise<void> {
    await this.db.query(readMigration("001_initial.down.sql"));
  }

  public async transaction<T>(work: (repository: AsyncLedgerRepository) => Promise<T>): Promise<T> {
    if (!this.pool) {
      return work(this);
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const scoped = new PostgresLedgerRepository(client, false);
      const result = await work(scoped);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    if (this.ownsPool && this.pool) {
      await this.pool.end();
    }
  }

  private async getUsageEvent(idempotencyKey: string): Promise<UsageEvent | undefined> {
    const result = await this.db.query(
      "SELECT idempotency_key, customer_id, meter, quantity, ts FROM usage_events WHERE idempotency_key = $1",
      [idempotencyKey]
    );
    return result.rows[0] ? usageFromRow(result.rows[0]) : undefined;
  }
}

function readMigration(name: string): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "migrations", name), "utf8");
}

function jsonValue<T>(value: unknown): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : (value as T);
}

function planFromRow(row: QueryResultRow): Plan {
  return {
    id: String(row.id),
    name: String(row.name),
    type: row.type as Plan["type"],
    currency: String(row.currency),
    components: jsonValue<Plan["components"]>(row.components_json)
  };
}

function couponFromRow(row: QueryResultRow): Coupon {
  const coupon: Coupon = {
    code: String(row.code),
    kind: row.kind as Coupon["kind"],
    value: Number(row.value),
    stackable: Boolean(row.stackable),
    redeemedCount: Number(row.redeemed_count ?? 0)
  };
  if (row.redemption_limit !== null && row.redemption_limit !== undefined) {
    coupon.redemptionLimit = Number(row.redemption_limit);
  }
  if (row.applies_to !== null && row.applies_to !== undefined) {
    coupon.appliesTo = jsonValue<string[]>(row.applies_to);
  }
  return coupon;
}

function usageFromRow(row: QueryResultRow): UsageEvent {
  return {
    idempotencyKey: String(row.idempotency_key),
    customerId: String(row.customer_id),
    meter: String(row.meter),
    quantity: Number(row.quantity),
    timestamp: String(row.ts)
  };
}

function customerFromRow(row: QueryResultRow): Customer {
  const customer: Customer = {
    id: String(row.id),
    name: String(row.name),
    taxProfile: jsonValue<Customer["taxProfile"]>(row.tax_profile_json),
    metadata: jsonValue<Customer["metadata"]>(row.metadata_json)
  };
  if (row.email !== null && row.email !== undefined) {
    customer.email = String(row.email);
  }
  return customer;
}

function subscriptionFromRow(row: QueryResultRow): SubscriptionAssignment {
  const assignment: SubscriptionAssignment = {
    customerId: String(row.customer_id),
    planId: String(row.plan_id),
    seats: Number(row.seats),
    startsOn: String(row.starts_on)
  };
  if (row.ends_on !== null && row.ends_on !== undefined) {
    assignment.endsOn = String(row.ends_on);
  }
  return assignment;
}

function simulationFromRow(row: QueryResultRow): SimulationRun {
  return {
    id: String(row.id),
    name: String(row.name),
    createdAt: String(row.created_at),
    context: jsonValue<SimulationRun["context"]>(row.context_json),
    invoice: jsonValue<SimulationRun["invoice"]>(row.invoice_json)
  };
}
