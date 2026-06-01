import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLedgerFlowQueryClient } from "../lib/queryClient";
import { AuditPage } from "../pages/AuditPage";
import { PlansPage } from "../pages/PlansPage";
import { ScenarioPage } from "../pages/ScenarioPage";

function renderWithQuery(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createLedgerFlowQueryClient()}>{ui}</QueryClientProvider>);
}

describe("API error envelopes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders GET endpoint envelopes on load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { code: "catalog_down", message: "Plans offline" } }), { status: 503 }))
    );

    renderWithQuery(<PlansPage />);

    expect(await screen.findByText(/catalog_down: plans offline/i)).toBeInTheDocument();
  });

  it("renders mutation endpoint envelopes across JSON workflow pages", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { code: "validation_error", message: "Malformed payload" } }), { status: 400 }))
    );

    const audit = renderWithQuery(<AuditPage />);
    await user.click(screen.getByRole("button", { name: /audit invoice/i }));
    expect(await screen.findByText(/validation_error: malformed payload/i)).toBeInTheDocument();
    audit.unmount();

    renderWithQuery(<ScenarioPage />);
    await user.click(screen.getByRole("button", { name: /compare scenarios/i }));
    expect(await screen.findByText(/validation_error: malformed payload/i)).toBeInTheDocument();
  });
});
