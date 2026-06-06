import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { buildSession, saveSession } from "../lib/session";
import { RequireSession, RequireWriteRole } from "./AuthGuards";
import { SessionProvider } from "./SessionProvider";

function renderGuarded(initialPath = "/") {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<RequireSession />}>
            <Route path="/" element={<p>Console</p>} />
            <Route
              path="/write"
              element={
                <RequireWriteRole>
                  <p>Write tools</p>
                </RequireWriteRole>
              }
            />
          </Route>
          <Route path="/login" element={<p>Login screen</p>} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>
  );
}

describe("auth guards", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("redirects anonymous users to login", () => {
    renderGuarded();

    expect(screen.getByText("Login screen")).toBeInTheDocument();
  });

  it("redirects anonymous users from a direct write guard", () => {
    render(
      <SessionProvider>
        <MemoryRouter initialEntries={["/write"]}>
          <Routes>
            <Route
              path="/write"
              element={
                <RequireWriteRole>
                  <p>Write tools</p>
                </RequireWriteRole>
              }
            />
            <Route path="/login" element={<p>Login screen</p>} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    );

    expect(screen.getByText("Login screen")).toBeInTheDocument();
  });

  it("allows authenticated sessions through", () => {
    saveSession(buildSession({ apiBaseUrl: "", token: "", tenantId: "default", role: "admin" }));
    renderGuarded();

    expect(screen.getByText("Console")).toBeInTheDocument();
  });

  it("redirects viewer sessions away from write routes", () => {
    saveSession(buildSession({ apiBaseUrl: "", token: "", tenantId: "default", role: "viewer" }));
    renderGuarded("/write");

    expect(screen.getByText("Console")).toBeInTheDocument();
  });

  it("allows editor sessions to write routes", () => {
    saveSession(buildSession({ apiBaseUrl: "", token: "", tenantId: "default", role: "editor" }));
    renderGuarded("/write");

    expect(screen.getByText("Write tools")).toBeInTheDocument();
  });
});
