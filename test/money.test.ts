import { describe, expect, it } from "vitest";

import { Money, RoundingMode, roundMinor } from "../src/index.js";

describe("Money", () => {
  it("throws when adding different currencies", () => {
    expect(() => new Money(100, "USD").add(new Money(100, "EUR"))).toThrow(/Currency mismatch/);
  });

  it("rounds major currency values into integer minor units", () => {
    expect(Money.fromMajor(10.235, "USD").amountMinor).toBe(1024);
  });

  it("rounds 2.5 to 2 under HALF_EVEN", () => {
    expect(roundMinor(2.5, RoundingMode.HALF_EVEN)).toBe(2);
    expect(roundMinor(2.5, RoundingMode.HALF_UP)).toBe(3);
  });

  it("supports arithmetic and comparison within a currency", () => {
    const result = new Money(500, "USD").subtract(new Money(125, "USD")).multiply(2);

    expect(result.toJSON()).toEqual({ amountMinor: 750, currency: "USD" });
    expect(result.compare(Money.zero("USD"))).toBe(1);
    expect(result.negate().amountMinor).toBe(-750);
    expect(Money.zero("USD").isZero()).toBe(true);
  });
});
