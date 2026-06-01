import { describe, expect, it } from "vitest";

import {
  applyDiscounts,
  validateCoupon,
  type Coupon,
  type DiscountableLineItem
} from "../src/index.js";

describe("discounts", () => {
  const lineItems: DiscountableLineItem[] = [
    { id: "base", description: "Base", amountMinor: 10000, currency: "USD" }
  ];

  it("rejects stacking two non-stackable coupons", () => {
    const coupons: Coupon[] = [
      { code: "A", kind: "percent", value: 10, stackable: false },
      { code: "B", kind: "fixed", value: 1000, stackable: false }
    ];

    expect(() => applyDiscounts(lineItems, coupons)).toThrow(/non-stackable/);
  });

  it("respects redemption limit", () => {
    expect(
      validateCoupon({ code: "SAVE", kind: "percent", value: 20, redemptionLimit: 3, stackable: true }, {
        redeemedCount: 3
      })
    ).toEqual({ valid: false, reason: "redemption_limit_reached" });
  });

  it("applies percent coupons before fixed coupons", () => {
    const result = applyDiscounts(lineItems, [
      { code: "FIXED", kind: "fixed", value: 1000, stackable: true },
      { code: "PCT", kind: "percent", value: 20, stackable: true }
    ]);

    expect(result.discounts).toEqual([
      { code: "PCT", amountMinor: -2000 },
      { code: "FIXED", amountMinor: -1000 }
    ]);
    expect(result.lineItems[0]?.discountAmountMinor).toBe(-3000);
  });

  it("rejects invalid coupons before applying them", () => {
    expect(() =>
      applyDiscounts(lineItems, [{ code: "BAD", kind: "percent", value: 101, stackable: true }])
    ).toThrow(/Invalid coupon BAD/);
  });

  it("rejects discounting line items across mixed currencies", () => {
    expect(() =>
      applyDiscounts(
        [
          { id: "usd", description: "USD", amountMinor: 1000, currency: "USD" },
          { id: "eur", description: "EUR", amountMinor: 1000, currency: "EUR" }
        ],
        [{ code: "SAVE", kind: "percent", value: 10, stackable: true }]
      )
    ).toThrow(/multiple currencies/);
  });
});
