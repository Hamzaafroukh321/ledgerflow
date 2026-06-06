import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { SessionProvider } from "../components/SessionProvider";
import { LoginPage } from "./LoginPage";

function renderLogin() {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Console opened</p>} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>
  );
}

describe("LoginPage", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("stores a provided tenant token session", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/api base url/i), "http://127.0.0.1:3000");
    await user.type(screen.getByLabelText(/api token/i), "tok:tenant-a:user-a:viewer");
    await user.clear(screen.getByLabelText(/tenant/i));
    await user.type(screen.getByLabelText(/tenant/i), "tenant-a");
    await user.clear(screen.getByLabelText(/subject/i));
    await user.type(screen.getByLabelText(/subject/i), "user-a");
    await user.selectOptions(screen.getByLabelText(/role/i), "viewer");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Console opened")).toBeInTheDocument();
    expect(window.localStorage.getItem("ledgerflow.console.sessions")).toContain("tenant-a");
  });

  it("starts a local demo session", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Use local demo" }));

    expect(screen.getByText("Console opened")).toBeInTheDocument();
    expect(window.localStorage.getItem("ledgerflow.console.sessions")).toContain("Local demo");
  });
});
