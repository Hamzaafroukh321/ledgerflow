import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { defaultInvoiceEngine } from "../../src/index.js";

const EXAMPLES = [
  "invoice-basic.json",
  "invoice-usage.json",
  "invoice-proration.json",
  "invoice-coupon-stack.json",
  "invoice-tax-exempt.json",
  "invoice-inclusive-tax.json",
  "invoice-reverse-charge.json",
  "invoice-over-credit.json"
];

describe("golden invoice fixtures", () => {
  it.each(EXAMPLES)("%s stays byte-stable", (file) => {
    const context = JSON.parse(readFileSync(join("examples", file), "utf8")) as unknown;
    const actual = stableStringify(defaultInvoiceEngine.simulate(context));
    const expected = readFileSync(
      join("test", "golden", "fixtures", file.replace(".json", ".invoice.json")),
      "utf8"
    );

    expect(actual).toBe(expected);
  });
});

function stableStringify(value: unknown): string {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stable(nested)])
    );
  }
  return value;
}
