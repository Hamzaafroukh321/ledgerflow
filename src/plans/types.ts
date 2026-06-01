export type PlanType = "flat" | "per_seat" | "tiered" | "volume" | "graduated" | "usage";

export interface Tier {
  upTo: number | "infinity";
  unitAmountMinor: number;
}

export interface PriceComponent {
  id: string;
  name: string;
  type: PlanType;
  currency: string;
  unitAmountMinor?: number;
  tiers?: Tier[];
  meter?: string;
  includedQuantity?: number;
}

export interface Plan {
  id: string;
  name: string;
  type: PlanType;
  currency: string;
  components: PriceComponent[];
}

export interface PricingTrace {
  id: string;
  rule: string;
  total: number;
  inputs: Record<string, unknown>;
  children: PricingTrace[];
}
