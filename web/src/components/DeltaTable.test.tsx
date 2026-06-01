import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeltaTable } from "./DeltaTable";
import type { ScenarioComparison } from "../lib/schemas";
import { classifyDelta } from "../lib/scenarioDeltas";

const invoice = {
  currency: "USD",
  lineItems: [],
  discounts: [],
  creditsApplied: [],
  taxLines: [],
  totals: { subtotal: 1000, discountTotal: 0, creditTotal: 0, tax: 90, total: 1090 },
  explanation: { id: "root", rule: "invoice_total", total: 1090, children: [] }
};

const audit = {
  summary: { valid: true, errorCount: 0, warningCount: 0, checkedAt: "now" },
  issues: []
};

const comparison: ScenarioComparison = {
  baseline: { name: "Base", invoice, audit },
  candidates: [{ name: "Candidate", invoice, audit }],
  deltas: [
    {
      from: "Base",
      to: "Candidate",
      subtotalDelta: 300,
      discountDelta: -50,
      creditDelta: 0,
      taxDelta: 25,
      totalDelta: 275
    }
  ]
};

describe("DeltaTable", () => {
  it("classifies positive, negative, and neutral deltas", () => {
    expect(classifyDelta(1)).toBe("positive");
    expect(classifyDelta(-1)).toBe("negative");
    expect(classifyDelta(0)).toBe("neutral");
  });

  it("renders signed money deltas and validity changes", () => {
    render(<DeltaTable comparison={comparison} />);

    expect(screen.getByRole("heading", { name: "Base" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Candidate" })).toBeInTheDocument();
    expect(screen.getByText("+$3.00")).toBeInTheDocument();
    expect(screen.getByText("-$0.50")).toBeInTheDocument();
    expect(screen.getByText("Stable")).toBeInTheDocument();
  });
});
