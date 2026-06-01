import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLedgerFlowQueryClient } from "../lib/queryClient";
import { RefundPage } from "./RefundPage";

function renderRefunds() {
  return render(
    <QueryClientProvider client={createLedgerFlowQueryClient()}>
      <RefundPage />
    </QueryClientProvider>
  );
}

describe("RefundPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("simulates a refund and renders allocations with trace", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          allocations: [
            { lineItemId: "base", amountMinor: 1838 },
            { lineItemId: "usage", amountMinor: 662 }
          ],
          creditNote: { amountMinor: 2500, currency: "USD", reason: "refund" },
          trace: {
            id: "refund",
            rule: "proportional_refund_allocation",
            total: 2500,
            children: [{ id: "refund-base", rule: "refund_line_item", total: 1838, children: [] }]
          }
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    renderRefunds();

    await user.selectOptions(screen.getByLabelText(/strategy/i), "sequential");
    await user.click(screen.getByRole("button", { name: /simulate refund/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/refunds\/simulate$/), expect.any(Object)));
    expect(await screen.findByText("Credit note: $25.00")).toBeInTheDocument();
    expect(screen.getByText("base")).toBeInTheDocument();
    expect(screen.getAllByText("$18.38")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /proportional_refund_allocation/i })).toBeInTheDocument();
  });

  it("shows parse errors before submitting", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderRefunds();

    fireEvent.change(screen.getByLabelText(/invoice json/i), { target: { value: "nope" } });
    await user.click(screen.getByRole("button", { name: /simulate refund/i }));

    expect(await screen.findByText(/unexpected token/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
