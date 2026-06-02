import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLedgerFlowQueryClient } from "../lib/queryClient";
import { PlansPage } from "./PlansPage";

function renderPlans() {
  return render(
    <QueryClientProvider client={createLedgerFlowQueryClient()}>
      <PlansPage />
    </QueryClientProvider>
  );
}

describe("PlansPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders plans from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                id: "starter_monthly",
                name: "Starter Monthly",
                type: "flat",
                currency: "USD",
                components: [
                  { id: "base", name: "Base", type: "flat", currency: "USD", unitAmountMinor: 2900 }
                ]
              },
              {
                id: "pro_monthly",
                name: "Pro Monthly",
                type: "per_seat",
                currency: "USD",
                components: [
                  {
                    id: "seat",
                    name: "Seat",
                    type: "per_seat",
                    currency: "USD",
                    unitAmountMinor: 1999
                  }
                ]
              }
            ])
          )
      )
    );
    renderPlans();

    expect(screen.getByText(/loading plans/i)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Starter Monthly" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pro Monthly" })).toBeInTheDocument();
    expect(screen.getByText("2 plans")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save plan/i })).toBeInTheDocument();
  });

  it("creates a plan and refetches the catalog", async () => {
    const user = userEvent.setup();
    const catalog = [
      {
        id: "starter_monthly",
        name: "Starter Monthly",
        type: "flat",
        currency: "USD",
        components: [
          { id: "base", name: "Base", type: "flat", currency: "USD", unitAmountMinor: 2900 }
        ]
      }
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          const plan = JSON.parse(String(init.body));
          catalog.push(plan);
          return new Response(JSON.stringify(plan));
        }
        return new Response(JSON.stringify(catalog));
      })
    );
    renderPlans();

    expect(await screen.findByRole("heading", { name: "Starter Monthly" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/plan json/i), {
      target: {
        value: JSON.stringify({
          id: "growth_monthly",
          name: "Growth Monthly",
          type: "per_seat",
          currency: "USD",
          components: [
            {
              id: "seat",
              name: "Seat",
              type: "per_seat",
              currency: "USD",
              unitAmountMinor: 4900
            }
          ]
        })
      }
    });
    await user.click(screen.getByRole("button", { name: /save plan/i }));

    expect(await screen.findByText(/saved growth_monthly/i)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Growth Monthly" })).toBeInTheDocument();
  });

  it("renders an empty state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([])))
    );
    renderPlans();

    expect(await screen.findByText(/no plans are available/i)).toBeInTheDocument();
  });

  it("renders typed API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { code: "internal_error", message: "Catalog unavailable" } }),
            {
              status: 500
            }
          )
      )
    );
    renderPlans();

    await waitFor(() =>
      expect(screen.getByText(/internal_error: catalog unavailable/i)).toBeInTheDocument()
    );
  });

  it("renders plan JSON parse failures before calling the API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([])));
    vi.stubGlobal("fetch", fetchMock);
    renderPlans();

    await screen.findByText(/no plans are available/i);
    fireEvent.change(screen.getByLabelText(/plan json/i), { target: { value: "not json" } });
    await user.click(screen.getByRole("button", { name: /save plan/i }));

    expect(screen.getByText(/unexpected token/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
