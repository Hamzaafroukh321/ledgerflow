import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { buildBillingContext } from "../lib/simulator";
import { SimulatorPage } from "./SimulatorPage";

describe("SimulatorPage", () => {
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
    render(<SimulatorPage />);

    await user.clear(screen.getByLabelText(/customer id/i));
    await user.clear(screen.getByLabelText(/currency/i));
    await user.clear(screen.getByLabelText(/seats/i));
    await user.click(screen.getByRole("button", { name: /validate context/i }));

    expect(await screen.findByText(/customer id is required/i)).toBeInTheDocument();
    expect(screen.getByText(/uppercase currency/i)).toBeInTheDocument();
    expect(screen.getByText(/seats must be at least 1/i)).toBeInTheDocument();
  });

  it("updates the context preview after valid submit", async () => {
    const user = userEvent.setup();
    render(<SimulatorPage />);

    await user.clear(screen.getByLabelText(/seats/i));
    await user.type(screen.getByLabelText(/seats/i), "9");
    await user.click(screen.getByRole("button", { name: /validate context/i }));

    expect(await screen.findByText(/"seats": 9/i)).toBeInTheDocument();
  });
});
