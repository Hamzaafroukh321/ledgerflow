import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("App", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders the login flow and opens the LedgerFlow shell", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]))));
    render(<App />);

    expect(screen.getByRole("heading", { name: /sign in to the billing operations console/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /use local demo/i }));

    expect(screen.getByRole("heading", { name: /billing operations console/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /simulator/i })).toBeInTheDocument();
    expect(screen.getByText(/explain every invoice/i)).toBeInTheDocument();
  });
});
