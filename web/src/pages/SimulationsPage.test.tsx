import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLedgerFlowQueryClient } from "../lib/queryClient";
import type { BillingContext, SimulationRun } from "../lib/schemas";
import { SimulationsPage } from "./SimulationsPage";

const context: BillingContext = {
  currency: "USD",
  period: { start: "2026-01-01", end: "2026-02-01" },
  customer: { id: "cus_1", taxProfile: { exempt: true, jurisdiction: "US-CA" } },
  subscription: { planId: "starter_monthly", seats: 1, changedOn: null },
  usage: [],
  coupons: [],
  credits: []
};

const invoice = {
  currency: "USD",
  lineItems: [],
  discounts: [],
  creditsApplied: [],
  taxLines: [],
  totals: { subtotal: 2900, discountTotal: 0, creditTotal: 0, tax: 0, total: 2900 },
  explanation: { id: "root", rule: "invoice_total", total: 2900, children: [] }
};

function renderSimulations() {
  return render(
    <QueryClientProvider client={createLedgerFlowQueryClient()}>
      <SimulationsPage />
    </QueryClientProvider>
  );
}

function page<T>(data: T[]) {
  return { data, page: { limit: 25, total: data.length, nextCursor: null } };
}

function pageWithCursor<T>(data: T[], nextCursor: string | null) {
  return { data, page: { limit: 25, total: 2, nextCursor } };
}

describe("SimulationsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists saved simulations and selects a run", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const runs = [
          run("sim_1", "January review", "2026-01-02T00:00:00.000Z", 2900),
          run("sim_2", "February review", "2026-02-02T00:00:00.000Z", 5400)
        ];
        const path = new URL(String(input), window.location.origin).pathname;
        return new Response(
          JSON.stringify(path.includes("sim_2") ? runs[1] : path.includes("sim_1") ? runs[0] : page(runs))
        );
      })
    );

    renderSimulations();

    expect(await screen.findByRole("button", { name: /january review/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /february review/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /february review/i }));

    expect(screen.getByText(/USD 5400/i)).toBeInTheDocument();
  });

  it("creates a saved simulation and refetches the list", async () => {
    const user = userEvent.setup();
    const runs: SimulationRun[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          const saved = run("sim_saved", "Quarterly review", "2026-03-01T00:00:00.000Z", 2900);
          runs.unshift(saved);
          return new Response(JSON.stringify(saved));
        }
        const path = new URL(String(_input), window.location.origin).pathname;
        return new Response(
          JSON.stringify(path.includes("sim_saved") ? runs[0] : page(runs))
        );
      })
    );
    renderSimulations();

    expect(await screen.findByText(/no saved simulations yet/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/run name/i), { target: { value: "Quarterly review" } });
    await user.click(screen.getByRole("button", { name: /save simulation/i }));

    expect(await screen.findByText(/simulation saved/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /quarterly review/i })).toBeInTheDocument();
  });

  it("pages through saved simulation history", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), window.location.origin);
        const first = run("sim_1", "January review", "2026-01-02T00:00:00.000Z", 2900);
        const second = run("sim_2", "February review", "2026-02-02T00:00:00.000Z", 5400);
        if (url.pathname.includes("sim_1")) {
          return new Response(JSON.stringify(first));
        }
        if (url.pathname.includes("sim_2")) {
          return new Response(JSON.stringify(second));
        }
        return new Response(
          JSON.stringify(url.searchParams.get("cursor") ? pageWithCursor([second], null) : pageWithCursor([first], "next"))
        );
      })
    );
    renderSimulations();

    expect(await screen.findByRole("button", { name: /january review/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next page/i }));
    expect(await screen.findByRole("button", { name: /february review/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /first page/i }));
    expect(await screen.findByRole("button", { name: /january review/i })).toBeInTheDocument();
  });

  it("renders JSON parse failures before calling the API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(page([]))));
    vi.stubGlobal("fetch", fetchMock);
    renderSimulations();

    await screen.findByText(/no saved simulations yet/i);
    fireEvent.change(screen.getByLabelText(/billing context json/i), {
      target: { value: "not json" }
    });
    await user.click(screen.getByRole("button", { name: /save simulation/i }));

    expect(screen.getByText(/unexpected token/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function run(id: string, name: string, createdAt: string, total: number): SimulationRun {
  return {
    id,
    name,
    createdAt,
    context,
    invoice: {
      ...invoice,
      totals: { ...invoice.totals, subtotal: total, total },
      explanation: { ...invoice.explanation, total }
    }
  };
}
