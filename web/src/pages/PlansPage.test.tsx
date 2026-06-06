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

function page<T>(data: T[]) {
  return { data, page: { limit: 25, total: data.length, nextCursor: null } };
}

function pageWithCursor<T>(data: T[], nextCursor: string | null) {
  return { data, page: { limit: 25, total: 2, nextCursor } };
}

const coupons = [{ code: "SAVE20", kind: "percent", value: 20, stackable: true }];

describe("PlansPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("renders plans from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (input: RequestInfo | URL) =>
          new Response(
            JSON.stringify(
              String(input).includes("/coupons")
                ? page(coupons)
                : page([
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
      )
    );
    renderPlans();

    expect(screen.getByText(/loading plans/i)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Starter Monthly" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pro Monthly" })).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "2 plans / 1 coupons")
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "SAVE20" })).toBeInTheDocument();
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
        return new Response(
          JSON.stringify(String(_input).includes("/coupons") ? page(coupons) : page(catalog))
        );
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
      vi.fn(async () => new Response(JSON.stringify(page([]))))
    );
    renderPlans();

    expect(await screen.findByText(/no plans are available/i)).toBeInTheDocument();
  });

  it("pages plan and coupon catalogs", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), window.location.origin);
        if (url.pathname.includes("/coupons")) {
          return new Response(
            JSON.stringify(
              url.searchParams.get("cursor")
                ? pageWithCursor([{ code: "WINTER", kind: "fixed", value: 500, stackable: false }], null)
                : pageWithCursor(coupons, "coupon-2")
            )
          );
        }
        return new Response(
          JSON.stringify(
            url.searchParams.get("cursor")
              ? pageWithCursor([
                  {
                    id: "enterprise",
                    name: "Enterprise",
                    type: "flat",
                    currency: "USD",
                    components: [
                      { id: "base", name: "Base", type: "flat", currency: "USD", unitAmountMinor: 9900 }
                    ]
                  }
                ], null)
              : pageWithCursor([
                  {
                    id: "starter",
                    name: "Starter",
                    type: "flat",
                    currency: "USD",
                    components: [
                      { id: "base", name: "Base", type: "flat", currency: "USD", unitAmountMinor: 2900 }
                    ]
                  }
                ], "plan-2")
          )
        );
      })
    );
    renderPlans();

    expect(await screen.findByRole("heading", { name: "Starter" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Next" })[0]);
    expect(await screen.findByRole("heading", { name: "Enterprise" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Next" })[1]);
    expect(await screen.findByRole("heading", { name: "WINTER" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "First" })[0]);
    expect(await screen.findByRole("heading", { name: "Starter" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "First" })[1]);
    expect(await screen.findByRole("heading", { name: "SAVE20" })).toBeInTheDocument();
  });

  it("hides write controls for viewer role", async () => {
    vi.stubEnv("VITE_LEDGERFLOW_ROLE", "viewer");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(page([]))))
    );
    renderPlans();

    expect(await screen.findByText(/no plans are available/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save plan/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/plan json/i)).not.toBeInTheDocument();
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
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(page([]))));
    vi.stubGlobal("fetch", fetchMock);
    renderPlans();

    await screen.findByText(/no plans are available/i);
    fireEvent.change(screen.getByLabelText(/plan json/i), { target: { value: "not json" } });
    await user.click(screen.getByRole("button", { name: /save plan/i }));

    expect(screen.getByText(/unexpected token/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
