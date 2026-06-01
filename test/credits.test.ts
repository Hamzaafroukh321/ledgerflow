import { describe, expect, it } from "vitest";

import { applyCredits, type Credit } from "../src/index.js";

describe("credits", () => {
  it("applies credits pre-tax before tax is computed", () => {
    const result = applyCredits(5000, [{ id: "cr_1", amountMinor: 1200, phase: "pre_tax" }], "pre_tax");

    expect(result.applied).toEqual([{ id: "cr_1", amountMinor: -1200, phase: "pre_tax" }]);
    expect(result.trace.total).toBe(-1200);
  });

  it("partial credit leaves remaining balance", () => {
    const credits: Credit[] = [{ id: "cr_1", amountMinor: 5000, phase: "post_tax" }];
    const result = applyCredits(1200, credits, "post_tax");

    expect(result.applied).toEqual([{ id: "cr_1", amountMinor: -1200, phase: "post_tax" }]);
    expect(result.remainingCredits).toEqual([{ id: "cr_1", amountMinor: 3800, phase: "post_tax" }]);
  });

  it("keeps credits from other phases for later application", () => {
    const result = applyCredits(1000, [{ id: "cr_1", amountMinor: 500, phase: "post_tax" }], "pre_tax");

    expect(result.applied).toEqual([]);
    expect(result.remainingCredits).toEqual([{ id: "cr_1", amountMinor: 500, phase: "post_tax" }]);
  });
});
