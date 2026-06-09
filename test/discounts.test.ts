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
      validateCoupon(
        { code: "SAVE", kind: "percent", value: 20, redemptionLimit: 3, stackable: true },
        {
          redeemedCount: 3
        }
      )
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

  it("caps fixed coupons at the eligible line subtotal", () => {
    const result = applyDiscounts(lineItems, [
      { code: "OVER", kind: "fixed", value: 20000, stackable: true }
    ]);

    expect(result.discounts).toEqual([{ code: "OVER", amountMinor: -10000 }]);
    expect(result.lineItems[0]?.discountAmountMinor).toBe(-10000);
    expect(result.trace.total).toBe(-10000);
  });

  it("only discounts lines matched by appliesTo and skips empty eligibility", () => {
    const result = applyDiscounts(
      [
        { id: "base", description: "Base", amountMinor: 10000, currency: "USD" },
        { id: "usage", description: "Usage", amountMinor: 5000, currency: "USD" }
      ],
      [
        { code: "BASE20", kind: "percent", value: 20, stackable: true, appliesTo: ["base"] },
        { code: "NO_MATCH", kind: "fixed", value: 1000, stackable: true, appliesTo: ["missing"] }
      ]
    );

    expect(result.discounts).toEqual([{ code: "BASE20", amountMinor: -2000 }]);
    expect(result.lineItems).toMatchObject([
      { id: "base", discountAmountMinor: -2000 },
      { id: "usage", discountAmountMinor: 0 }
    ]);
    expect(result.trace.inputs).toEqual({ couponCodes: ["BASE20", "NO_MATCH"] });
  });

  it("allows one non-stackable coupon by itself", () => {
    const result = applyDiscounts(lineItems, [
      { code: "ONLY", kind: "percent", value: 25, stackable: false }
    ]);

    expect(result.discounts).toEqual([{ code: "ONLY", amountMinor: -2500 }]);
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
