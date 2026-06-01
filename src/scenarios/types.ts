import type { Invoice } from "../invoice/types.js";
import type { InvoiceAuditReport } from "../audit/types.js";

export interface ScenarioInput {
  name: string;
  context: unknown;
}

export interface ScenarioResult {
  name: string;
  invoice: Invoice;
  audit: InvoiceAuditReport;
}

export interface ScenarioDelta {
  from: string;
  to: string;
  subtotalDelta: number;
  discountDelta: number;
  creditDelta: number;
  taxDelta: number;
  totalDelta: number;
}

export interface ScenarioComparison {
  baseline: ScenarioResult;
  candidates: ScenarioResult[];
  deltas: ScenarioDelta[];
}
