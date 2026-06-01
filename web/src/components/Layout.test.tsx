import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { routes } from "../routes";
import { Toast } from "./Toast";

describe("Layout", () => {
  it("renders primary navigation", () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /plans/i })).toHaveAttribute("href", "/plans");
  });

  it("renders toast messages with status semantics", () => {
    render(<Toast message={{ tone: "success", title: "Saved", detail: "Customer profile updated" }} />);

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByText(/customer profile updated/i)).toBeInTheDocument();
  });
});
