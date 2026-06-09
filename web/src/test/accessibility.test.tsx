import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Layout } from "../components/Layout";
import { SessionProvider } from "../components/SessionProvider";
import { createLedgerFlowQueryClient } from "../lib/queryClient";
import { CustomersPage } from "../pages/CustomersPage";
import { PlansPage } from "../pages/PlansPage";
import { RefundPage } from "../pages/RefundPage";
import { SimulatorPage } from "../pages/SimulatorPage";

function renderWithQuery(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createLedgerFlowQueryClient()}>{ui}</QueryClientProvider>);
}

function page<T>(data: T[]) {
  return { data, page: { limit: 25, total: data.length, nextCursor: null } };
}

describe("accessibility", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("keeps the app shell navigable", async () => {
    window.localStorage.setItem(
      "ledgerflow.console.sessions",
      JSON.stringify([
        {
          id: "local:default:admin:admin",
          label: "Default",
          apiBaseUrl: "",
          token: "",
          tenantId: "default",
          subject: "admin",
          role: "admin"
        }
      ])
    );
    const { container } = render(
      <SessionProvider>
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      </SessionProvider>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("keeps data-backed pages free of automated axe violations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), window.location.origin).pathname;
        if (path.includes("/coupons")) {
          return new Response(JSON.stringify(page([])));
        }
        if (path.includes("/plans")) {
          return new Response(
            JSON.stringify(page([{ id: "starter", name: "Starter", type: "flat", currency: "USD", components: [] }]))
          );
        }
        return new Response(
          JSON.stringify([
            {
              id: "cus_acme",
              name: "Acme Finance",
              email: "billing@acme.example",
              taxProfile: { exempt: false, jurisdiction: "US-CA" },
              metadata: {}
            }
          ])
        );
      })
    );

    const plans = renderWithQuery(<PlansPage />);
    expect(await screen.findByRole("heading", { name: "Starter" })).toBeInTheDocument();
    expect(await axe(plans.container)).toHaveNoViolations();
    plans.unmount();

    const customers = renderWithQuery(<CustomersPage />);
    expect(await screen.findByRole("heading", { name: "Acme Finance" })).toBeInTheDocument();
    expect(await axe(customers.container)).toHaveNoViolations();
  });

  it("keeps form-heavy workflows accessible", async () => {
    const simulator = renderWithQuery(<SimulatorPage />);
    expect(await axe(simulator.container)).toHaveNoViolations();
    simulator.unmount();

    const refunds = renderWithQuery(<RefundPage />);
    expect(await axe(refunds.container)).toHaveNoViolations();
  });
});
