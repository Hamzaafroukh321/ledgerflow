import { describe, expect, it } from "vitest";

import { formatMinor, parseMajorToMinor, signedMinor } from "./money";

describe("money helpers", () => {
  it("formats minor units as currency", () => {
    expect(formatMinor(123456, "USD")).toBe("$1,234.56");
    expect(formatMinor(0, "USD")).toBe("$0.00");
    expect(formatMinor(-450, "USD")).toBe("-$4.50");
  });

  it("parses display values into minor units", () => {
    expect(parseMajorToMinor("1,234.50")).toBe(123450);
    expect(parseMajorToMinor("$0.05")).toBe(5);
    expect(parseMajorToMinor("-4.50")).toBe(-450);
  });

  it("rejects invalid display values and currency codes", () => {
    expect(() => parseMajorToMinor("1.234")).toThrow();
    expect(() => formatMinor(100, "usd")).toThrow();
  });

  it("renders signed deltas", () => {
    expect(signedMinor(125, "USD")).toBe("+$1.25");
    expect(signedMinor(-125, "USD")).toBe("-$1.25");
    expect(signedMinor(0, "USD")).toBe("$0.00");
  });
});
