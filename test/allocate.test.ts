import { describe, expect, it } from "vitest";

import { Money, allocate, allocateEvenly } from "../src/index.js";

describe("allocate", () => {
  it("distributes a 1-cent remainder to the largest weight", () => {
    const parts = allocate(new Money(1, "USD"), [1, 2]);

    expect(parts.map((part) => part.amountMinor)).toEqual([0, 1]);
  });

  it("always sums exactly to the total", () => {
    const parts = allocate(new Money(101, "USD"), [7, 11, 13]);

    expect(parts.reduce((sum, part) => sum + part.amountMinor, 0)).toBe(101);
  });

  it("allocates 100 evenly across 3", () => {
    const parts = allocateEvenly(new Money(100, "USD"), 3);

    expect(parts.map((part) => part.amountMinor)).toEqual([34, 33, 33]);
  });
});
