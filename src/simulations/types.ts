import type { BillingContext } from "../engine/context.js";
import type { Invoice } from "../invoice/types.js";

export interface SimulationRun {
  id: string;
  name: string;
  createdAt: string;
  context: BillingContext;
  invoice: Invoice;
}
