import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLedgerFlowQueryClient } from "../lib/queryClient";
import { buildBillingContext } from "../lib/simulator";
import { SimulatorPage } from "./SimulatorPage";

function renderSimulator() {
  return render(
    <QueryClientProvider client={createLedgerFlowQueryClient()}>
      <SimulatorPage />
    </QueryClientProvider>
  );
}

describe("SimulatorPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds a billing context from form values", () => {
    expect(
      buildBillingContext({
        currency: "USD",
        customerId: "cus_1",
        jurisdiction: "US-CA",
        planId: "pro_monthly",
        seats: 3,
        periodStart: "2026-01-01",
        periodEnd: "2026-02-01",
        apiCalls: 50,
        couponCode: "SAVE20",
        creditMajor: "1.25"
      })
    ).toMatchObject({
      subscription: { planId: "pro_monthly", seats: 3 },
      credits: [{ amountMinor: 125 }]
    });
  });

  it("shows validation errors for invalid required values", async () => {
    const user = userEvent.setup();
    renderSimulator();

    await user.clear(screen.getByLabelText(/customer id/i));
    await user.clear(screen.getByLabelText(/currency/i));
    await user.clear(screen.getByLabelText(/seats/i));
    await user.click(screen.getByRole("button", { name: /simulate invoice/i }));

    expect(await screen.findByText(/customer id is required/i)).toBeInTheDocument();
    expect(screen.getByText(/uppercase currency/i)).toBeInTheDocument();
    expect(screen.getByText(/seats must be at least 1/i)).toBeInTheDocument();
  });

  it("updates the context preview after valid submit", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            currency: "USD",
            lineItems: [{ id: "base", description: "Base subscription", amountMinor: 9900, currency: "USD", traceId: "base" }],
            discounts: [],
            creditsApplied: [],
            taxLines: [],
            totals: { subtotal: 9900, discountTotal: 0, creditTotal: 0, tax: 0, total: 9900 },
            explanation: { id: "root", rule: "invoice_total", total: 9900 }
          })
        )
      )
    );
    renderSimulator();

    await user.clear(screen.getByLabelText(/seats/i));
    await user.type(screen.getByLabelText(/seats/i), "9");
    await user.click(screen.getByRole("button", { name: /simulate invoice/i }));

    expect(await screen.findByText(/"seats": 9/i)).toBeInTheDocument();
    expect(await screen.findByText("Base subscription")).toBeInTheDocument();
    expect(screen.getAllByText("$99.00").length).toBeGreaterThan(0);
  });
});
