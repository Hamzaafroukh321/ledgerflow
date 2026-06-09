import type { CustomerRepository } from "../customers/repository.js";
import type { Customer, SubscriptionAssignment } from "../customers/types.js";
import type { Coupon } from "../discounts/types.js";
import type { Plan } from "../plans/types.js";
import type { SimulationRun } from "../simulations/types.js";
import type {
  CouponRepository,
  PlanRepository,
  SimulationRunRepository,
  UsageRepository
} from "../storage/repository.js";
import type { UsageEvent, UsageIngestResult } from "../usage/types.js";

export interface LedgerRepository {
  plans: PlanRepository;
  coupons: CouponRepository;
  usage: UsageRepository;
  customers: CustomerRepository;
  simulations: SimulationRunRepository;
  transaction<T>(work: () => T): T;
  close(): void;
}

export interface RepositoryFactoryEnv {
  LEDGERFLOW_DB?: string | undefined;
  LEDGERFLOW_DB_URL?: string | undefined;
}

export interface AsyncLedgerRepository {
  plans: AsyncPlanRepository;
  coupons: AsyncCouponRepository;
  usage: AsyncUsageRepository;
  customers: AsyncCustomerRepository;
  simulations: AsyncSimulationRunRepository;
  transaction<T>(work: (repository: AsyncLedgerRepository) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface AsyncPlanRepository {
  list(): Promise<Plan[]>;
  get(planId: string): Promise<Plan | undefined>;
  save(plan: Plan): Promise<void>;
}

export interface AsyncCouponRepository {
  list(): Promise<Coupon[]>;
  get(code: string): Promise<Coupon | undefined>;
  save(coupon: Coupon): Promise<void>;
}

export interface AsyncUsageRepository {
  ingest(event: UsageEvent): Promise<UsageIngestResult>;
  list(): Promise<UsageEvent[]>;
}

export interface AsyncCustomerRepository {
  listCustomers(): Promise<Customer[]>;
  getCustomer(customerId: string): Promise<Customer | undefined>;
  saveCustomer(customer: Customer): Promise<void>;
  listSubscriptions(customerId?: string): Promise<SubscriptionAssignment[]>;
  saveSubscription(assignment: SubscriptionAssignment): Promise<void>;
}

export interface AsyncSimulationRunRepository {
  list(): Promise<SimulationRun[]>;
  get(runId: string): Promise<SimulationRun | undefined>;
  save(run: SimulationRun): Promise<void>;
}
