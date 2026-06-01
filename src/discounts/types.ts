export interface Coupon {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  redemptionLimit?: number;
  redeemedCount?: number;
  appliesTo?: string[];
  stackable: boolean;
}

export interface CouponValidationContext {
  redeemedCount?: number;
}

export interface DiscountableLineItem {
  id: string;
  description: string;
  amountMinor: number;
  currency: string;
  traceId?: string;
  discountAmountMinor?: number;
}

export interface DiscountApplication {
  code: string;
  amountMinor: number;
}

export interface DiscountTrace {
  id: string;
  rule: string;
  total: number;
  inputs: Record<string, unknown>;
  children: DiscountTrace[];
}
