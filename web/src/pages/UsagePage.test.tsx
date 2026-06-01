import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLedgerFlowQueryClient } from "../lib/queryClient";
import { UsagePage } from "./UsagePage";

const event = {
  idempotencyKey: "evt_1",
  customerId: "cus_acme",
  meter: "api_calls",
  quantity: 100,
  timestamp: "2026-01-20T00:00:00.000Z"
};

function renderUsage() {
  return render(
    <QueryClientProvider client={createLedgerFlowQueryClient()}>
      <UsagePage />
    </QueryClientProvider>
  );
}

describe("UsagePage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists events and refetches after ingest", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([event])))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accepted: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...event }, { ...event, idempotencyKey: "evt_2", quantity: 250 }])));
    vi.stubGlobal("fetch", fetchMock);
    renderUsage();

    expect(await screen.findByText("100 total units")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/customer id/i), { target: { value: "cus_beta" } });
    fireEvent.change(screen.getByLabelText(/^meter$/i), { target: { value: "seats" } });
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: "250" } });
    fireEvent.change(screen.getByLabelText(/timestamp/i), { target: { value: "2026-01-21T00:00:00.000Z" } });
    await user.click(screen.getByRole("button", { name: /ingest usage/i }));

    expect(await screen.findByText("350 total units")).toBeInTheDocument();
    expect(screen.getByText("Usage accepted")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/usage\/events$/), expect.objectContaining({ method: "POST" }));
  });

  it("aggregates usage for the selected period", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([event])))
      .mockResolvedValueOnce(new Response(JSON.stringify({ api_calls: 100, seats: 12 })));
    vi.stubGlobal("fetch", fetchMock);
    renderUsage();

    expect(await screen.findByText("api_calls")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/period start/i), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText(/period end/i), { target: { value: "2026-02-01" } });
    await user.click(screen.getByRole("button", { name: /aggregate usage/i }));

    expect(await screen.findByText("seats")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/usage\/aggregate$/), expect.objectContaining({ method: "POST" }));
  });
});
