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

  it("omits blank optional adjustments from generated contexts", () => {
    expect(
      buildBillingContext({
        currency: "USD",
        customerId: "cus_1",
        jurisdiction: "US-CA",
        planId: "starter_monthly",
        seats: 1,
        periodStart: "2026-01-01",
        periodEnd: "2026-02-01",
        apiCalls: 0,
        couponCode: "",
        creditMajor: ""
      })
    ).toMatchObject({ coupons: [], credits: [] });
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
            explanation: {
              id: "root",
              rule: "invoice_total",
              total: 9900,
              children: [{ id: "subtotal", rule: "subtotal", total: 9900, children: [] }]
            }
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
    expect(screen.getByRole("button", { name: /collapse invoice_total/i })).toBeInTheDocument();
  });

  it("saves the simulated invoice context to the library", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST" && String(_input).includes("/simulations")) {
          return new Response(
            JSON.stringify({
              id: "sim_saved",
              name: "Saved from simulator",
              createdAt: "2026-01-01T00:00:00.000Z",
              context: JSON.parse(String(init.body)).context,
              invoice: invoiceResponse()
            })
          );
        }
        return new Response(JSON.stringify(invoiceResponse()));
      })
    );
    renderSimulator();

    await user.click(screen.getByRole("button", { name: /simulate invoice/i }));
    await user.click(await screen.findByRole("button", { name: /save to library/i }));

    expect(await screen.findByText(/saved saved from simulator/i)).toBeInTheDocument();
  });

  it("renders save-to-library failures", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST" && String(_input).includes("/simulations")) {
          return new Response(
            JSON.stringify({ error: { code: "forbidden", message: "Write denied" } }),
            { status: 403 }
          );
        }
        return new Response(JSON.stringify(invoiceResponse()));
      })
    );
    renderSimulator();

    await user.click(screen.getByRole("button", { name: /simulate invoice/i }));
    await user.click(await screen.findByRole("button", { name: /save to library/i }));

    expect(await screen.findByText(/forbidden: Write denied/i)).toBeInTheDocument();
  });

  it("renders typed API failures", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: "unauthorized", message: "Token required" } }), {
          status: 401,
          statusText: "Unauthorized"
        })
      )
    );
    renderSimulator();

    await user.click(screen.getByRole("button", { name: /simulate invoice/i }));

    expect(await screen.findByText(/unauthorized: Token required/i)).toBeInTheDocument();
  });

  it("renders unexpected simulation failures", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Network down");
      })
    );
    renderSimulator();

    await user.click(screen.getByRole("button", { name: /simulate invoice/i }));

    expect(await screen.findByText(/unexpected error/i)).toBeInTheDocument();
  });

  it("renders unexpected save-to-library failures", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST" && String(_input).includes("/simulations")) {
          throw new Error("Network down");
        }
        return new Response(JSON.stringify(invoiceResponse()));
      })
    );
    renderSimulator();

    await user.click(screen.getByRole("button", { name: /simulate invoice/i }));
    await user.click(await screen.findByRole("button", { name: /save to library/i }));

    expect(await screen.findByText(/unexpected error/i)).toBeInTheDocument();
  });
});

function invoiceResponse() {
  return {
    currency: "USD",
    lineItems: [
      {
        id: "base",
        description: "Base subscription",
        amountMinor: 9900,
        currency: "USD",
        traceId: "base"
      }
    ],
    discounts: [],
    creditsApplied: [],
    taxLines: [],
    totals: { subtotal: 9900, discountTotal: 0, creditTotal: 0, tax: 0, total: 9900 },
    explanation: {
      id: "root",
      rule: "invoice_total",
      total: 9900,
      children: [{ id: "subtotal", rule: "subtotal", total: 9900, children: [] }]
    }
  };
}
