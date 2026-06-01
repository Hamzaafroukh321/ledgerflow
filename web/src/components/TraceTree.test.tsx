import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { flattenTrace } from "../lib/traceTree";
import { TraceTree } from "./TraceTree";

const trace = {
  id: "root",
  rule: "invoice_total",
  total: 1200,
  children: [
    { id: "subtotal", rule: "subtotal", total: 1000, children: [] },
    { id: "tax", rule: "tax", total: 200, children: [] }
  ]
};

describe("TraceTree", () => {
  it("flattens recursive traces with depth", () => {
    expect(flattenTrace(trace)).toEqual([
      { id: "root", rule: "invoice_total", total: 1200, depth: 0 },
      { id: "subtotal", rule: "subtotal", total: 1000, depth: 1 },
      { id: "tax", rule: "tax", total: 200, depth: 1 }
    ]);
  });

  it("renders and toggles child nodes", async () => {
    const user = userEvent.setup();
    render(<TraceTree currency="USD" trace={trace} />);

    expect(screen.getByText(/subtotal/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /collapse invoice_total/i }));
    expect(screen.queryByText(/leaf subtotal/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /expand invoice_total/i }));
    expect(screen.getByText(/leaf subtotal/i)).toBeInTheDocument();
  });
});
