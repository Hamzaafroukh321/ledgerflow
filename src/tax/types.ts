export interface TaxProfile {
  exempt: boolean;
  jurisdiction: string;
  reverseCharge?: boolean;
  inclusive?: boolean;
  rates?: Record<string, number>;
}

export interface TaxableLineItem {
  id: string;
  description: string;
  amountMinor: number;
  currency: string;
}

export interface TaxLine {
  jurisdiction: string;
  rate: number;
  amountMinor: number;
  inclusive: boolean;
}

export interface TaxTrace {
  id: string;
  rule: string;
  total: number;
  inputs: Record<string, unknown>;
  children: TaxTrace[];
}
