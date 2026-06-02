import Database from "better-sqlite3";

import type { Customer, SubscriptionAssignment } from "../customers/types.js";
import type { Coupon } from "../discounts/types.js";
import type { Plan } from "../plans/types.js";
import type { SimulationRun } from "../simulations/types.js";
import { sameUsageEvent, validateUsageEvent } from "../usage/usage-store.js";
import type { UsageEvent, UsageIngestResult } from "../usage/types.js";
import type {
  CouponRepository,
  PlanRepository,
  SimulationRunRepository,
  UsageRepository
} from "./repository.js";
import type { CustomerRepository } from "../customers/repository.js";

export class SqliteStore {
  private readonly db: Database.Database;

  public constructor(path = ":memory:") {
    this.db = new Database(path);
    this.migrate();
  }

  public close(): void {
    this.db.close();
  }

  public list(): Plan[] {
    return this.listPlans();
  }

  public listPlans(): Plan[] {
    const rows = this.db
      .prepare("SELECT id, name, type, currency, components_json FROM plans ORDER BY id")
      .all() as PlanRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      currency: row.currency,
      components: JSON.parse(row.components_json) as Plan["components"]
    }));
  }

  public get(idOrCode: string): Plan | Coupon | undefined {
    return this.getPlan(idOrCode) ?? this.getCoupon(idOrCode);
  }

  public save(value: Plan | Coupon): void {
    if ("components" in value) {
      this.savePlan(value);
    } else {
      this.saveCoupon(value);
    }
  }

  public listCoupons(): Coupon[] {
    const rows = this.db
      .prepare(
        "SELECT code, kind, value, redemption_limit, applies_to, stackable, redeemed_count FROM coupons ORDER BY code"
      )
      .all() as CouponRow[];
    return rows.map((row) => this.couponFromRow(row));
  }

  public ingest(event: UsageEvent): UsageIngestResult {
    validateUsageEvent(event);
    const existing = this.getUsageEvent(event.idempotencyKey);
    if (existing) {
      return sameUsageEvent(existing, event)
        ? { accepted: false, reason: "duplicate_idempotency_key" }
        : { accepted: false, reason: "idempotency_conflict", existingEvent: existing };
    }
    const result = this.db
      .prepare(
        "INSERT OR IGNORE INTO usage_events (idempotency_key, customer_id, meter, quantity, ts) VALUES (?, ?, ?, ?, ?)"
      )
      .run(event.idempotencyKey, event.customerId, event.meter, event.quantity, event.timestamp);
    return result.changes === 1
      ? { accepted: true }
      : { accepted: false, reason: "duplicate_idempotency_key" };
  }

  public listUsageEvents(): UsageEvent[] {
    const rows = this.db
      .prepare(
        "SELECT idempotency_key, customer_id, meter, quantity, ts FROM usage_events ORDER BY ts"
      )
      .all() as UsageRow[];
    return rows.map((row) => ({
      idempotencyKey: row.idempotency_key,
      customerId: row.customer_id,
      meter: row.meter,
      quantity: row.quantity,
      timestamp: row.ts
    }));
  }

  public listCustomers(): Customer[] {
    const rows = this.db
      .prepare("SELECT id, name, email, tax_profile_json, metadata_json FROM customers ORDER BY id")
      .all() as CustomerRow[];
    return rows.map((row) => this.customerFromRow(row));
  }

  public getCustomer(customerId: string): Customer | undefined {
    const row = this.db
      .prepare(
        "SELECT id, name, email, tax_profile_json, metadata_json FROM customers WHERE id = ?"
      )
      .get(customerId) as CustomerRow | undefined;
    return row ? this.customerFromRow(row) : undefined;
  }

  public saveCustomer(customer: Customer): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO customers (id, name, email, tax_profile_json, metadata_json) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        customer.id,
        customer.name,
        customer.email ?? null,
        JSON.stringify(customer.taxProfile),
        JSON.stringify(customer.metadata)
      );
  }

  public listSubscriptions(customerId?: string): SubscriptionAssignment[] {
    const query =
      customerId === undefined
        ? "SELECT customer_id, plan_id, seats, starts_on, ends_on FROM subscriptions ORDER BY customer_id, starts_on, plan_id"
        : "SELECT customer_id, plan_id, seats, starts_on, ends_on FROM subscriptions WHERE customer_id = ? ORDER BY starts_on, plan_id";
    const rows =
      customerId === undefined
        ? (this.db.prepare(query).all() as SubscriptionRow[])
        : (this.db.prepare(query).all(customerId) as SubscriptionRow[]);
    return rows.map((row) => {
      const assignment: SubscriptionAssignment = {
        customerId: row.customer_id,
        planId: row.plan_id,
        seats: row.seats,
        startsOn: row.starts_on
      };
      if (row.ends_on !== null) {
        assignment.endsOn = row.ends_on;
      }
      return assignment;
    });
  }

  public saveSubscription(assignment: SubscriptionAssignment): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO subscriptions (customer_id, plan_id, starts_on, seats, ends_on) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        assignment.customerId,
        assignment.planId,
        assignment.startsOn,
        assignment.seats,
        assignment.endsOn ?? null
      );
  }

  public listSimulationRuns(): SimulationRun[] {
    const rows = this.db
      .prepare(
        "SELECT id, name, created_at, context_json, invoice_json FROM simulation_runs ORDER BY created_at DESC, id"
      )
      .all() as SimulationRunRow[];
    return rows.map((row) => this.simulationRunFromRow(row));
  }

  public getSimulationRun(runId: string): SimulationRun | undefined {
    const row = this.db
      .prepare(
        "SELECT id, name, created_at, context_json, invoice_json FROM simulation_runs WHERE id = ?"
      )
      .get(runId) as SimulationRunRow | undefined;
    return row ? this.simulationRunFromRow(row) : undefined;
  }

  public saveSimulationRun(run: SimulationRun): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO simulation_runs (id, name, created_at, context_json, invoice_json) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        run.id,
        run.name,
        run.createdAt,
        JSON.stringify(run.context),
        JSON.stringify(run.invoice)
      );
  }

  private getUsageEvent(idempotencyKey: string): UsageEvent | undefined {
    const row = this.db
      .prepare(
        "SELECT idempotency_key, customer_id, meter, quantity, ts FROM usage_events WHERE idempotency_key = ?"
      )
      .get(idempotencyKey) as UsageRow | undefined;
    if (!row) {
      return undefined;
    }
    return {
      idempotencyKey: row.idempotency_key,
      customerId: row.customer_id,
      meter: row.meter,
      quantity: row.quantity,
      timestamp: row.ts
    };
  }

  private customerFromRow(row: CustomerRow): Customer {
    const customer: Customer = {
      id: row.id,
      name: row.name,
      taxProfile: JSON.parse(row.tax_profile_json) as Customer["taxProfile"],
      metadata: JSON.parse(row.metadata_json) as Customer["metadata"]
    };
    if (row.email !== null) {
      customer.email = row.email;
    }
    return customer;
  }

  private simulationRunFromRow(row: SimulationRunRow): SimulationRun {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      context: JSON.parse(row.context_json) as SimulationRun["context"],
      invoice: JSON.parse(row.invoice_json) as SimulationRun["invoice"]
    };
  }

  private getPlan(planId: string): Plan | undefined {
    const row = this.db
      .prepare("SELECT id, name, type, currency, components_json FROM plans WHERE id = ?")
      .get(planId) as PlanRow | undefined;
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      currency: row.currency,
      components: JSON.parse(row.components_json) as Plan["components"]
    };
  }

  private savePlan(plan: Plan): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO plans (id, name, type, currency, components_json) VALUES (?, ?, ?, ?, ?)"
      )
      .run(plan.id, plan.name, plan.type, plan.currency, JSON.stringify(plan.components));
  }

  private getCoupon(code: string): Coupon | undefined {
    const row = this.db
      .prepare(
        "SELECT code, kind, value, redemption_limit, applies_to, stackable, redeemed_count FROM coupons WHERE code = ?"
      )
      .get(code) as CouponRow | undefined;
    if (!row) {
      return undefined;
    }
    return this.couponFromRow(row);
  }

  private couponFromRow(row: CouponRow): Coupon {
    const coupon: Coupon = {
      code: row.code,
      kind: row.kind,
      value: row.value,
      stackable: row.stackable === 1,
      redeemedCount: row.redeemed_count
    };
    if (row.redemption_limit !== null) {
      coupon.redemptionLimit = row.redemption_limit;
    }
    if (row.applies_to !== null) {
      coupon.appliesTo = JSON.parse(row.applies_to) as string[];
    }
    return coupon;
  }

  private saveCoupon(coupon: Coupon): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO coupons (code, kind, value, redemption_limit, applies_to, stackable, redeemed_count) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        coupon.code,
        coupon.kind,
        coupon.value,
        coupon.redemptionLimit ?? null,
        coupon.appliesTo ? JSON.stringify(coupon.appliesTo) : null,
        coupon.stackable ? 1 : 0,
        coupon.redeemedCount ?? 0
      );
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        currency TEXT NOT NULL,
        components_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS coupons (
        code TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        value INTEGER NOT NULL,
        redemption_limit INTEGER,
        applies_to TEXT,
        stackable INTEGER NOT NULL,
        redeemed_count INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS usage_events (
        idempotency_key TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        meter TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        ts TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        tax_profile_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS subscriptions (
        customer_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        starts_on TEXT NOT NULL,
        seats INTEGER NOT NULL,
        ends_on TEXT,
        PRIMARY KEY (customer_id, plan_id, starts_on)
      );
      CREATE TABLE IF NOT EXISTS simulation_runs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        context_json TEXT NOT NULL,
        invoice_json TEXT NOT NULL
      );
    `);
  }
}

export class SqlitePlanRepository implements PlanRepository {
  private readonly store: SqliteStore;

  public constructor(path = ":memory:") {
    this.store = new SqliteStore(path);
  }

  public list(): Plan[] {
    return this.store.listPlans();
  }

  public get(planId: string): Plan | undefined {
    const value = this.store.get(planId);
    return value && "components" in value ? value : undefined;
  }

  public save(plan: Plan): void {
    this.store.save(plan);
  }

  public close(): void {
    this.store.close();
  }
}

export class SqliteCouponRepository implements CouponRepository {
  private readonly store: SqliteStore;

  public constructor(path = ":memory:") {
    this.store = new SqliteStore(path);
  }

  public list(): Coupon[] {
    return this.store.listCoupons();
  }

  public get(code: string): Coupon | undefined {
    const value = this.store.get(code);
    return value && "code" in value ? value : undefined;
  }

  public save(coupon: Coupon): void {
    this.store.save(coupon);
  }

  public close(): void {
    this.store.close();
  }
}

export class SqliteUsageRepository implements UsageRepository {
  private readonly store: SqliteStore;

  public constructor(path = ":memory:") {
    this.store = new SqliteStore(path);
  }

  public ingest(event: UsageEvent): UsageIngestResult {
    return this.store.ingest(event);
  }

  public list(): UsageEvent[] {
    return this.store.listUsageEvents();
  }

  public close(): void {
    this.store.close();
  }
}

export class SqliteCustomerRepository implements CustomerRepository {
  private readonly store: SqliteStore;

  public constructor(path = ":memory:") {
    this.store = new SqliteStore(path);
  }

  public listCustomers(): Customer[] {
    return this.store.listCustomers();
  }

  public getCustomer(customerId: string): Customer | undefined {
    return this.store.getCustomer(customerId);
  }

  public saveCustomer(customer: Customer): void {
    this.store.saveCustomer(customer);
  }

  public listSubscriptions(customerId?: string): SubscriptionAssignment[] {
    return this.store.listSubscriptions(customerId);
  }

  public saveSubscription(assignment: SubscriptionAssignment): void {
    this.store.saveSubscription(assignment);
  }

  public close(): void {
    this.store.close();
  }
}

export class SqliteSimulationRunRepository implements SimulationRunRepository {
  private readonly store: SqliteStore;

  public constructor(path = ":memory:") {
    this.store = new SqliteStore(path);
  }

  public list(): SimulationRun[] {
    return this.store.listSimulationRuns();
  }

  public get(runId: string): SimulationRun | undefined {
    return this.store.getSimulationRun(runId);
  }

  public save(run: SimulationRun): void {
    this.store.saveSimulationRun(run);
  }

  public close(): void {
    this.store.close();
  }
}

interface PlanRow {
  id: string;
  name: string;
  type: Plan["type"];
  currency: string;
  components_json: string;
}

interface CouponRow {
  code: string;
  kind: Coupon["kind"];
  value: number;
  redemption_limit: number | null;
  applies_to: string | null;
  stackable: number;
  redeemed_count: number;
}

interface UsageRow {
  idempotency_key: string;
  customer_id: string;
  meter: string;
  quantity: number;
  ts: string;
}

interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  tax_profile_json: string;
  metadata_json: string;
}

interface SubscriptionRow {
  customer_id: string;
  plan_id: string;
  seats: number;
  starts_on: string;
  ends_on: string | null;
}

interface SimulationRunRow {
  id: string;
  name: string;
  created_at: string;
  context_json: string;
  invoice_json: string;
}
