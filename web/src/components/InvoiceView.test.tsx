import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InvoiceView } from "./InvoiceView";

describe("InvoiceView", () => {
  it("renders line items and totals", () => {
    render(
      <InvoiceView
        invoice={{
          currency: "USD",
          lineItems: [{ id: "line_1", description: "Seat charge", amountMinor: 1200, currency: "USD", traceId: "t1" }],
          discounts: [],
          creditsApplied: [],
          taxLines: [],
          totals: { subtotal: 1200, discountTotal: 0, creditTotal: 0, tax: 0, total: 1200 },
          explanation: { id: "root", rule: "invoice_total", total: 1200 }
        }}
      />
    );

    expect(screen.getByText("Seat charge")).toBeInTheDocument();
    expect(screen.getAllByText("$12.00")).toHaveLength(3);
  });
});
