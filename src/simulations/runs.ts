import { randomUUID } from "node:crypto";

import type { BillingContext } from "../engine/context.js";
import type { Invoice } from "../invoice/types.js";
import type { SimulationRun } from "./types.js";

export function createSimulationRun(input: {
  id?: string;
  name?: string;
  createdAt?: string;
  context: BillingContext;
  invoice: Invoice;
}): SimulationRun {
  const id = input.id ?? `sim_${randomUUID()}`;
  const name = input.name ?? defaultRunName(input.context);
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (!id.trim()) {
    throw new Error("Simulation run id is required");
  }
  if (!name.trim()) {
    throw new Error("Simulation run name is required");
  }
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new Error(`Invalid simulation run timestamp: ${createdAt}`);
  }
  return {
    id,
    name,
    createdAt,
    context: structuredClone(input.context),
    invoice: structuredClone(input.invoice)
  };
}

function defaultRunName(context: BillingContext): string {
  return `${context.customer.id} ${context.subscription.planId} ${context.period.start}`;
}
