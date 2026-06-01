import { describe, expect, it } from "vitest";

import { priceComponent, type PriceComponent } from "../src/index.js";

describe("priceComponent", () => {
  const tiers: PriceComponent = {
    id: "api",
    name: "API calls",
    type: "graduated",
    currency: "USD",
    tiers: [
      { upTo: 100, unitAmountMinor: 10 },
      { upTo: 200, unitAmountMinor: 8 },
      { upTo: "infinity", unitAmountMinor: 5 }
    ]
  };

  it("prices graduated tiers cumulatively", () => {
    const result = priceComponent(tiers, 150);

    expect(result.amount.amountMinor).toBe(1400);
    expect(result.trace.children.map((child) => child.total)).toEqual([1000, 400]);
  });

  it("prices volume tiers at the single applicable rate", () => {
    const result = priceComponent({ ...tiers, type: "volume" }, 150);

    expect(result.amount.amountMinor).toBe(1200);
    expect(result.trace.inputs.selectedUnitAmountMinor).toBe(8);
  });

  it("scales per-seat pricing", () => {
    const result = priceComponent(
      {
        id: "seats",
        name: "Seats",
        type: "per_seat",
        currency: "USD",
        unitAmountMinor: 1999
      },
      5
    );

    expect(result.amount.amountMinor).toBe(9995);
  });
});
