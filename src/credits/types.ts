export type CreditPhase = "pre_tax" | "post_tax";

export interface Credit {
  id: string;
  amountMinor: number;
  phase: CreditPhase;
}

export interface AppliedCredit {
  id: string;
  amountMinor: number;
  phase: CreditPhase;
}

export interface CreditTrace {
  id: string;
  rule: string;
  total: number;
  inputs: Record<string, unknown>;
  children: CreditTrace[];
}
