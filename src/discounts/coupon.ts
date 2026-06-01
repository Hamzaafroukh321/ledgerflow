import type { Coupon, CouponValidationContext } from "./types.js";

export function validateCoupon(
  coupon: Coupon,
  context: CouponValidationContext = {}
): { valid: boolean; reason?: string } {
  if (!coupon.code.trim()) {
    return { valid: false, reason: "missing_code" };
  }
  if (coupon.kind === "percent" && (coupon.value <= 0 || coupon.value > 100)) {
    return { valid: false, reason: "invalid_percent_value" };
  }
  if (coupon.kind === "fixed" && (!Number.isInteger(coupon.value) || coupon.value <= 0)) {
    return { valid: false, reason: "invalid_fixed_value" };
  }

  const redeemedCount = context.redeemedCount ?? coupon.redeemedCount ?? 0;
  if (coupon.redemptionLimit !== undefined && redeemedCount >= coupon.redemptionLimit) {
    return { valid: false, reason: "redemption_limit_reached" };
  }

  return { valid: true };
}
