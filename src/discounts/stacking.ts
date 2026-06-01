import { allocate } from "../money/allocate.js";
import { Money } from "../money/Money.js";
import type {
  Coupon,
  DiscountableLineItem,
  DiscountApplication,
  DiscountTrace
} from "./types.js";
import { validateCoupon } from "./coupon.js";

export function applyDiscounts(
  lineItems: DiscountableLineItem[],
  coupons: Coupon[]
): { lineItems: DiscountableLineItem[]; discounts: DiscountApplication[]; trace: DiscountTrace } {
  ensureSingleCurrency(lineItems);
  ensureCouponsValid(coupons);
  ensureStackingAllowed(coupons);

  const workingItems = lineItems.map((item) => ({ ...item, discountAmountMinor: 0 }));
  const orderedCoupons = [...coupons].sort((left, right) => couponOrder(left) - couponOrder(right));
  const discounts: DiscountApplication[] = [];
  const children: DiscountTrace[] = [];

  for (const coupon of orderedCoupons) {
    const eligibleItems = workingItems.filter((item) => {
      return !coupon.appliesTo || coupon.appliesTo.includes(item.id);
    });
    const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + discountedAmount(item), 0);
    if (eligibleSubtotal <= 0) {
      continue;
    }

    const discountMinor =
      coupon.kind === "percent"
        ? Math.round((eligibleSubtotal * coupon.value) / 100)
        : Math.min(coupon.value, eligibleSubtotal);

    const allocated = allocate(
      new Money(discountMinor, eligibleItems[0]?.currency ?? lineItems[0]?.currency ?? "USD"),
      eligibleItems.map((item) => discountedAmount(item))
    );

    eligibleItems.forEach((item, index) => {
      item.discountAmountMinor = (item.discountAmountMinor ?? 0) - (allocated[index]?.amountMinor ?? 0);
    });

    discounts.push({ code: coupon.code, amountMinor: -discountMinor });
    children.push(traceNode(`discount-${coupon.code}`, "apply_coupon", -discountMinor, { coupon }));
  }

  const total = discounts.reduce((sum, discount) => sum + discount.amountMinor, 0);
  return {
    lineItems: workingItems,
    discounts,
    trace: {
      ...traceNode("discounts", "discount_stacking", total, {
        couponCodes: orderedCoupons.map((coupon) => coupon.code)
      }),
      children
    }
  };
}

function ensureSingleCurrency(lineItems: DiscountableLineItem[]): void {
  const currencies = new Set(lineItems.map((item) => item.currency));
  if (currencies.size > 1) {
    throw new Error("Cannot apply one discount set across multiple currencies");
  }
}

function ensureCouponsValid(coupons: Coupon[]): void {
  for (const coupon of coupons) {
    const result = validateCoupon(coupon);
    if (!result.valid) {
      throw new Error(`Invalid coupon ${coupon.code}: ${result.reason ?? "unknown_reason"}`);
    }
  }
}

function ensureStackingAllowed(coupons: Coupon[]): void {
  const nonStackable = coupons.filter((coupon) => !coupon.stackable);
  if (nonStackable.length > 1 || (nonStackable.length === 1 && coupons.length > 1)) {
    throw new Error("Cannot stack non-stackable coupons");
  }
}

function couponOrder(coupon: Coupon): number {
  return coupon.kind === "percent" ? 0 : 1;
}

function discountedAmount(item: DiscountableLineItem): number {
  return Math.max(0, item.amountMinor + (item.discountAmountMinor ?? 0));
}

function traceNode(
  id: string,
  rule: string,
  total: number,
  inputs: Record<string, unknown>
): DiscountTrace {
  return { id, rule, total, inputs, children: [] };
}
