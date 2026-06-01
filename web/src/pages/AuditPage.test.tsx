import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLedgerFlowQueryClient } from "../lib/queryClient";
import { AuditPage } from "./AuditPage";

function renderAudit() {
  return render(
    <QueryClientProvider client={createLedgerFlowQueryClient()}>
      <AuditPage />
    </QueryClientProvider>
  );
}

describe("AuditPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("audits pasted invoice JSON", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            checkedAt: "now",
            summary: { valid: true, errors: 0, warnings: 0 },
            issues: []
          })
        )
      )
    );
    renderAudit();

    await user.click(screen.getByRole("button", { name: /audit invoice/i }));

    expect(await screen.findByText("Valid")).toBeInTheDocument();
    expect(screen.getByText("Errors (0)")).toBeInTheDocument();
  });

  it("renders parse failures", async () => {
    const user = userEvent.setup();
    renderAudit();

    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "{{}");
    await user.click(screen.getByRole("button", { name: /audit invoice/i }));

    expect(await screen.findByText(/currency/i)).toBeInTheDocument();
  });
});
