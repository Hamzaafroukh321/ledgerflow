export type RefundStrategy = "proportional" | "sequential";

export interface RefundAllocation {
  lineItemId: string;
  amountMinor: number;
}

export interface CreditNote {
  invoiceId?: string;
  amountMinor: number;
  allocations: RefundAllocation[];
}

export interface RefundTrace {
  id: string;
  rule: string;
  total: number;
  inputs: Record<string, unknown>;
  children: RefundTrace[];
}
