import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { routes } from "../routes";
import { Layout } from "./Layout";
import { Toast } from "./Toast";
import { SessionProvider } from "./SessionProvider";

describe("Layout", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders primary navigation", () => {
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
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    );

    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /plans/i })).toHaveAttribute("href", "/plans");
    expect(screen.getByLabelText(/tenant/i)).toHaveValue("local:default:admin:admin");
  });

  it("omits tenant controls when no session is active", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <Layout />,
          children: [{ index: true, element: <p>Overview</p> }]
        }
      ],
      { initialEntries: ["/"] }
    );
    render(
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    );

    expect(screen.queryByLabelText(/tenant/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });

  it("renders toast messages with status semantics", () => {
    render(<Toast message={{ tone: "success", title: "Saved", detail: "Customer profile updated" }} />);

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByText(/customer profile updated/i)).toBeInTheDocument();
  });
});
