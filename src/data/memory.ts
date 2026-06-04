import { MemoryCustomerRepository } from "../customers/repository.js";
import {
  MemoryCouponRepository,
  MemoryPlanRepository,
  MemorySimulationRunRepository,
  MemoryUsageRepository
} from "../storage/memory.js";
import type { LedgerRepository } from "./repository.js";

export class MemoryLedgerRepository implements LedgerRepository {
  private closed = false;

  public readonly plans = new MemoryPlanRepository();
  public readonly coupons = new MemoryCouponRepository();
  public readonly usage = new MemoryUsageRepository();
  public readonly customers = new MemoryCustomerRepository();
  public readonly simulations = new MemorySimulationRunRepository();

  public transaction<T>(work: () => T): T {
    if (this.closed) {
      throw new Error("Repository is closed");
    }
    return work();
  }

  public close(): void {
    this.closed = true;
  }
}
