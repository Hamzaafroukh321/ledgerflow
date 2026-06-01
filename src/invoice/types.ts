import type { AppliedCredit } from "../credits/types.js";
import type { DiscountApplication } from "../discounts/types.js";
import type { TaxLine } from "../tax/types.js";
import type { TraceNode } from "./trace.js";

export interface LineItem {
  id: string;
  description: string;
  amountMinor: number;
  currency: string;
  traceId: string;
}

export interface InvoiceTotals {
  subtotal: number;
  discountTotal: number;
  creditTotal: number;
  tax: number;
  total: number;
}

export interface Invoice {
  id?: string;
  currency: string;
  lineItems: LineItem[];
  discounts: DiscountApplication[];
  creditsApplied: AppliedCredit[];
  taxLines: TaxLine[];
  totals: InvoiceTotals;
  explanation: TraceNode;
}
