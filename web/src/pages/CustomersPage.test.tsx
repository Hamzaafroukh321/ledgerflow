import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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
    await user.clear(screen.getByLabelText(/customer id/i));
    await user.type(screen.getByLabelText(/customer id/i), "cus_globex");
    await user.clear(screen.getByLabelText(/^name$/i));
    await user.type(screen.getByLabelText(/^name$/i), "Globex Finance");
    await user.clear(screen.getByLabelText(/email/i));
    await user.type(screen.getByLabelText(/email/i), "billing@globex.example");
    await user.clear(screen.getByLabelText(/tax jurisdiction/i));
    await user.type(screen.getByLabelText(/tax jurisdiction/i), "GB");
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
    await user.clear(screen.getByLabelText(/plan id/i));
    await user.type(screen.getByLabelText(/plan id/i), "enterprise_monthly");
    await user.clear(screen.getByLabelText(/seats/i));
    await user.type(screen.getByLabelText(/seats/i), "12");
    await user.clear(screen.getByLabelText(/profile date/i));
    await user.type(screen.getByLabelText(/profile date/i), "2026-02-01");
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
