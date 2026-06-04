import type { Customer, SubscriptionAssignment } from "../customers/types.js";
import type { Coupon } from "../discounts/types.js";
import type { Plan } from "../plans/types.js";
import type { SimulationRun } from "../simulations/types.js";
import type { UsageEvent, UsageIngestResult } from "../usage/types.js";
import type { AsyncLedgerRepository, LedgerRepository } from "./repository.js";

type SourceRepository = LedgerRepository | AsyncLedgerRepository;
type ScopedKeyKind = "plan" | "coupon" | "usage" | "customer" | "simulation";

export function scopeRepository(
  repository: SourceRepository,
  tenantId: string,
  principalId = "system"
): AsyncLedgerRepository {
  return new ScopedLedgerRepository(repository, tenantId, principalId);
}

class ScopedLedgerRepository implements AsyncLedgerRepository {
  public constructor(
    private readonly repository: SourceRepository,
    private readonly tenantId: string,
    private readonly principalId: string
  ) {}

  public readonly plans = {
    list: async (): Promise<Plan[]> => {
      const plans = await this.repository.plans.list();
      return plans
        .filter((plan) => isScopedKey(plan.id, "plan", this.tenantId))
        .map((plan) => ({ ...plan, id: publicKey(plan.id) }));
    },
    get: async (planId: string): Promise<Plan | undefined> => {
      const plan = await this.repository.plans.get(scopedKey("plan", this.tenantId, planId));
      return plan ? { ...plan, id: publicKey(plan.id) } : undefined;
    },
    save: async (plan: Plan): Promise<void> => {
      await this.repository.plans.save({
        ...plan,
        id: scopedKey("plan", this.tenantId, plan.id)
      });
    }
  };

  public readonly coupons = {
    list: async (): Promise<Coupon[]> => {
      const coupons = await this.repository.coupons.list();
      return coupons
        .filter((coupon) => isScopedKey(coupon.code, "coupon", this.tenantId))
        .map((coupon) => ({ ...coupon, code: publicKey(coupon.code) }));
    },
    get: async (code: string): Promise<Coupon | undefined> => {
      const coupon = await this.repository.coupons.get(scopedKey("coupon", this.tenantId, code));
      return coupon ? { ...coupon, code: publicKey(coupon.code) } : undefined;
    },
    save: async (coupon: Coupon): Promise<void> => {
      await this.repository.coupons.save({
        ...coupon,
        code: scopedKey("coupon", this.tenantId, coupon.code)
      });
    }
  };

  public readonly usage = {
    ingest: async (event: UsageEvent): Promise<UsageIngestResult> =>
      await this.repository.usage.ingest({
        ...event,
        idempotencyKey: scopedKey("usage", this.tenantId, event.idempotencyKey)
      }),
    list: async (): Promise<UsageEvent[]> => {
      const events = await this.repository.usage.list();
      return events
        .filter((event) => isScopedKey(event.idempotencyKey, "usage", this.tenantId))
        .map((event) => ({
          ...event,
          idempotencyKey: publicKey(event.idempotencyKey)
        }));
    }
  };

  public readonly customers = {
    listCustomers: async (): Promise<Customer[]> => {
      const customers = await this.repository.customers.listCustomers();
      return customers
        .filter((customer) => isScopedKey(customer.id, "customer", this.tenantId))
        .map((customer) => ({ ...customer, id: publicKey(customer.id) }));
    },
    getCustomer: async (customerId: string): Promise<Customer | undefined> => {
      const customer = await this.repository.customers.getCustomer(
        scopedKey("customer", this.tenantId, customerId)
      );
      return customer ? { ...customer, id: publicKey(customer.id) } : undefined;
    },
    saveCustomer: async (customer: Customer): Promise<void> => {
      await this.repository.customers.saveCustomer({
        ...customer,
        id: scopedKey("customer", this.tenantId, customer.id)
      });
    },
    listSubscriptions: async (customerId?: string): Promise<SubscriptionAssignment[]> => {
      const scopedCustomerId = customerId
        ? scopedKey("customer", this.tenantId, customerId)
        : undefined;
      const assignments = await this.repository.customers.listSubscriptions(scopedCustomerId);
      return assignments
        .filter((assignment) => isScopedKey(assignment.customerId, "customer", this.tenantId))
        .map((assignment) => ({
          ...assignment,
          customerId: publicKey(assignment.customerId),
          planId: publicKey(assignment.planId)
        }));
    },
    saveSubscription: async (assignment: SubscriptionAssignment): Promise<void> => {
      await this.repository.customers.saveSubscription({
        ...assignment,
        customerId: scopedKey("customer", this.tenantId, assignment.customerId),
        planId: scopedKey("plan", this.tenantId, assignment.planId)
      });
    }
  };

  public readonly simulations = {
    list: async (): Promise<SimulationRun[]> => {
      const runs = await this.repository.simulations.list();
      return runs
        .filter((run) => isScopedKey(run.id, "simulation", this.tenantId))
        .map((run) => this.publicSimulation(run));
    },
    get: async (runId: string): Promise<SimulationRun | undefined> => {
      const run = await this.repository.simulations.get(
        scopedKey("simulation", this.tenantId, runId)
      );
      return run ? this.publicSimulation(run) : undefined;
    },
    save: async (run: SimulationRun): Promise<void> => {
      await this.repository.simulations.save({
        ...run,
        id: scopedKey("simulation", this.tenantId, run.id),
        context: {
          ...run.context,
          subscription: {
            ...run.context.subscription,
            planId: publicKey(run.context.subscription.planId)
          }
        },
        name: run.name,
        createdAt: run.createdAt
      });
    }
  };

  public async transaction<T>(work: (repository: AsyncLedgerRepository) => Promise<T>): Promise<T> {
    return await work(this);
  }

  public async close(): Promise<void> {
    await this.repository.close();
  }

  private publicSimulation(run: SimulationRun): SimulationRun {
    return {
      ...run,
      id: publicKey(run.id),
      context: {
        ...run.context,
        subscription: {
          ...run.context.subscription,
          planId: publicKey(run.context.subscription.planId)
        }
      }
    };
  }
}

function scopedKey(kind: ScopedKeyKind, tenantId: string, id: string): string {
  return `${kind}:${tenantId}:${id}`;
}

function isScopedKey(value: string, kind: ScopedKeyKind, tenantId: string): boolean {
  return value.startsWith(`${kind}:${tenantId}:`);
}

function publicKey(value: string): string {
  const parts = value.split(":");
  return parts.length >= 3 ? parts.slice(2).join(":") : value;
}
