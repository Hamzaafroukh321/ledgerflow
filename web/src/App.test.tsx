import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders the LedgerFlow shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /billing operations console/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /simulator/i })).toBeInTheDocument();
    expect(screen.getByText(/explain every invoice/i)).toBeInTheDocument();
  });
});
