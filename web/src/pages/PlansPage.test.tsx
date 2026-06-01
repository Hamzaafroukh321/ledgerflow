import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              id: "starter_monthly",
              name: "Starter Monthly",
              type: "flat",
              currency: "USD",
              components: [{ id: "base", name: "Base", type: "flat" }]
            },
            {
              id: "pro_monthly",
              name: "Pro Monthly",
              type: "per_seat",
              currency: "USD",
              components: [{ id: "seat", name: "Seat", type: "per_seat" }]
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
  });

  it("renders an empty state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]))));
    renderPlans();

    expect(await screen.findByText(/no plans are available/i)).toBeInTheDocument();
  });

  it("renders typed API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: "internal_error", message: "Catalog unavailable" } }), {
          status: 500
        })
      )
    );
    renderPlans();

    await waitFor(() => expect(screen.getByText(/internal_error: catalog unavailable/i)).toBeInTheDocument());
  });
});
