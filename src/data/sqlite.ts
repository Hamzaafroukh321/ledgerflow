import type { Customer, SubscriptionAssignment } from "../customers/types.js";
import type { Coupon } from "../discounts/types.js";
import type { Plan } from "../plans/types.js";
import { SqliteStore } from "../storage/sqlite.js";
import type { SimulationRun } from "../simulations/types.js";
import type { UsageEvent, UsageIngestResult } from "../usage/types.js";
import type { LedgerRepository } from "./repository.js";

export class SqliteLedgerRepository implements LedgerRepository {
  private readonly store: SqliteStore;

  public constructor(path = ":memory:") {
    this.store = new SqliteStore(path);
  }

  public readonly plans = {
    list: (): Plan[] => this.store.listPlans(),
    get: (planId: string): Plan | undefined => {
      const value = this.store.get(planId);
      return value && "components" in value ? value : undefined;
    },
    save: (plan: Plan): void => this.store.save(plan)
  };

  public readonly coupons = {
    list: (): Coupon[] => this.store.listCoupons(),
    get: (code: string): Coupon | undefined => {
      const value = this.store.get(code);
      return value && "code" in value ? value : undefined;
    },
    save: (coupon: Coupon): void => this.store.save(coupon)
  };

  public readonly usage = {
    ingest: (event: UsageEvent): UsageIngestResult => this.store.ingest(event),
    list: (): UsageEvent[] => this.store.listUsageEvents()
  };

  public readonly customers = {
    listCustomers: (): Customer[] => this.store.listCustomers(),
    getCustomer: (customerId: string): Customer | undefined => this.store.getCustomer(customerId),
    saveCustomer: (customer: Customer): void => this.store.saveCustomer(customer),
    listSubscriptions: (customerId?: string): SubscriptionAssignment[] =>
      this.store.listSubscriptions(customerId),
    saveSubscription: (assignment: SubscriptionAssignment): void =>
      this.store.saveSubscription(assignment)
  };

  public readonly simulations = {
    list: (): SimulationRun[] => this.store.listSimulationRuns(),
    get: (runId: string): SimulationRun | undefined => this.store.getSimulationRun(runId),
    save: (run: SimulationRun): void => this.store.saveSimulationRun(run)
  };

  public transaction<T>(work: () => T): T {
    return this.store.transaction(work);
  }

  public close(): void {
    this.store.close();
  }
}
