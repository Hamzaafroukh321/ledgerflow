import { describe, expect, it } from "vitest";

import { Money, prorate } from "../src/index.js";

describe("proration", () => {
  const period = { start: "2025-01-01", end: "2025-02-01" };

  it("prorates a mid-cycle upgrade by remaining days", () => {
    const result = prorate(new Money(3100, "USD"), period, {
      start: "2025-01-16",
      end: "2025-02-01"
    });

    expect(result.amount.amountMinor).toBe(1600);
    expect(result.trace.inputs.activeDays).toBe(16);
  });

  it("charges full amount when change is on the first day", () => {
    const result = prorate(new Money(3100, "USD"), period, period);

    expect(result.amount.amountMinor).toBe(3100);
  });

  it("charges a minimal amount when change is on the last day", () => {
    const result = prorate(new Money(3100, "USD"), period, {
      start: "2025-01-31",
      end: "2025-02-01"
    });

    expect(result.amount.amountMinor).toBe(100);
  });

  it("returns zero when the effective interval is outside the period", () => {
    const result = prorate(new Money(3100, "USD"), period, {
      start: "2025-02-01",
      end: "2025-02-15"
    });

    expect(result.amount.amountMinor).toBe(0);
  });

  it("rejects an invalid effective interval", () => {
    expect(() =>
      prorate(new Money(3100, "USD"), period, {
        start: "2025-01-20",
        end: "2025-01-20"
      })
    ).toThrow(/effective interval/);
  });
});
