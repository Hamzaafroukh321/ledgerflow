import type { CustomerRepository } from "../customers/repository.js";
import type {
  CouponRepository,
  PlanRepository,
  SimulationRunRepository,
  UsageRepository
} from "../storage/repository.js";

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
