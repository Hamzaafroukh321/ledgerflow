import { describe, expect, it } from "vitest";

import { computeTax, type TaxableLineItem } from "../src/index.js";

describe("tax", () => {
  const lineItems: TaxableLineItem[] = [
    { id: "base", description: "Base", amountMinor: 10000, currency: "USD" }
  ];

  it("charges zero tax for an exempt customer", () => {
    const result = computeTax(lineItems, { exempt: true, jurisdiction: "US-CA" });

    expect(result.taxLines).toEqual([]);
    expect(result.trace.total).toBe(0);
  });

  it("computes exclusive tax", () => {
    const result = computeTax(lineItems, {
      exempt: false,
      jurisdiction: "US-CA",
      rates: { "US-CA": 0.1 }
    });

    expect(result.taxLines[0]?.amountMinor).toBe(1000);
  });

  it("extracts inclusive tax", () => {
    const result = computeTax(lineItems, {
      exempt: false,
      jurisdiction: "GB",
      inclusive: true,
      rates: { GB: 0.2 }
    });

    expect(result.taxLines[0]?.amountMinor).toBe(1667);
  });

  it("does not charge tax for reverse charge", () => {
    const result = computeTax(lineItems, {
      exempt: false,
      jurisdiction: "DE",
      reverseCharge: true
    });

    expect(result.taxLines).toEqual([]);
    expect(result.trace.rule).toBe("reverse_charge");
  });
});
