import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLedgerFlowQueryClient } from "../lib/queryClient";
import { CustomersPage } from "./CustomersPage";

const customer = {
  id: "cus_acme",
  name: "Acme Finance",
  email: "billing@acme.example",
  taxProfile: { exempt: false, jurisdiction: "US-CA" },
  metadata: { source: "web_console" }
};

function renderCustomers() {
  return render(
    <QueryClientProvider client={createLedgerFlowQueryClient()}>
      <CustomersPage />
    </QueryClientProvider>
  );
}

describe("CustomersPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a customer and refetches the list", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([])))
      .mockResolvedValueOnce(new Response(JSON.stringify(customer)))
      .mockResolvedValueOnce(new Response(JSON.stringify([customer])));
    vi.stubGlobal("fetch", fetchMock);
    renderCustomers();

    expect(await screen.findByText("0 records")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/customer id/i), { target: { value: "cus_globex" } });
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Globex Finance" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "billing@globex.example" } });
    fireEvent.change(screen.getByLabelText(/tax jurisdiction/i), { target: { value: "GB" } });
    await user.click(screen.getByRole("button", { name: /create customer/i }));

    expect(await screen.findByRole("heading", { name: "Acme Finance" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/customers$/), expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("assigns a subscription and loads the billing profile", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([customer])))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ customerId: "cus_acme", planId: "pro_monthly", seats: 5, startsOn: "2026-01-15" }))
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            customer,
            activeSubscription: { customerId: "cus_acme", planId: "pro_monthly", seats: 5, startsOn: "2026-01-15" }
          })
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    renderCustomers();

    expect(await screen.findByRole("heading", { name: "Acme Finance" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/plan id/i), { target: { value: "enterprise_monthly" } });
    fireEvent.change(screen.getByLabelText(/seats/i), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText(/profile date/i), { target: { value: "2026-02-01" } });
    await user.click(screen.getByRole("button", { name: /assign subscription/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/subscriptions$/), expect.any(Object)));
    await user.click(screen.getByRole("button", { name: /load billing profile/i }));

    expect(await screen.findByText("pro_monthly")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/customers\/cus_acme\/billing-profile\?onDate=2026-02-01$/),
      expect.any(Object)
    );
  });

  it("renders API errors from customer mutations", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify([customer])))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { code: "validation_error", message: "Customer email is invalid" } }), {
            status: 400
          })
        )
    );
    renderCustomers();

    expect(await screen.findByRole("heading", { name: "Acme Finance" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create customer/i }));

    expect(await screen.findByText(/validation_error: customer email is invalid/i)).toBeInTheDocument();
  });
});
