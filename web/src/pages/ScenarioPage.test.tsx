import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLedgerFlowQueryClient } from "../lib/queryClient";
import { ScenarioPage } from "./ScenarioPage";

function renderScenarios() {
  return render(
    <QueryClientProvider client={createLedgerFlowQueryClient()}>
      <ScenarioPage />
    </QueryClientProvider>
  );
}

describe("ScenarioPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("submits contexts and renders candidate deltas", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          baseline: {
            name: "Starter baseline",
            invoice: invoice(1000),
            audit: audit(true)
          },
          candidates: [
            {
              name: "Pro candidate",
              invoice: invoice(1250),
              audit: audit(true)
            }
          ],
          deltas: [
            {
              from: "Starter baseline",
              to: "Pro candidate",
              subtotalDelta: 200,
              discountDelta: -50,
              creditDelta: 0,
              taxDelta: 100,
              totalDelta: 250
            }
          ]
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    renderScenarios();

    await user.click(screen.getByRole("button", { name: /compare scenarios/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/scenarios\/compare$/), expect.any(Object)));
    expect(await screen.findByText("Pro candidate")).toBeInTheDocument();
    expect(screen.getByText("+$2.50")).toBeInTheDocument();
    expect(screen.getByText("Stable")).toBeInTheDocument();
  });

  it("shows validation errors before calling the API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderScenarios();

    fireEvent.change(screen.getByLabelText(/baseline context json/i), { target: { value: "not json" } });
    await user.click(screen.getByRole("button", { name: /compare scenarios/i }));

    expect(await screen.findByText(/unexpected token/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function invoice(total: number) {
  return {
    currency: "USD",
    lineItems: [],
    discounts: [],
    creditsApplied: [],
    taxLines: [],
    totals: { subtotal: total, discountTotal: 0, creditTotal: 0, tax: 0, total },
    explanation: { id: "root", rule: "invoice_total", total, children: [] }
  };
}

function audit(valid: boolean) {
  return {
    summary: { valid, errorCount: valid ? 0 : 1, warningCount: 0, checkedAt: "now" },
    issues: []
  };
}
