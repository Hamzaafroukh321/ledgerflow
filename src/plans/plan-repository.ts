import type { Plan } from "./types.js";

export interface PlanRepository {
  list(): Promise<Plan[]>;
  get(planId: string): Promise<Plan | undefined>;
}

export async function loadPlan(repository: PlanRepository, planId: string): Promise<Plan> {
  const plan = await repository.get(planId);
  if (!plan) {
    throw new Error(`Plan not found: ${planId}`);
  }
  return plan;
}
