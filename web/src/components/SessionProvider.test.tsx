import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { buildSession, saveSession } from "../lib/session";
import { SessionProvider } from "./SessionProvider";
import { useSession } from "./sessionContext";

function Probe() {
  const { login, logout, session, sessions, switchSession } = useSession();
  return (
    <div>
      <p>{session?.subject ?? "none"}</p>
      <p>{sessions.length} sessions</p>
      <button
        type="button"
        onClick={() =>
          login(buildSession({ apiBaseUrl: "", token: "editor-token", subject: "editor" }))
        }
      >
        Login editor
      </button>
      <button type="button" onClick={() => switchSession(sessions[1]?.id ?? sessions[0]?.id ?? "")}>
        Switch
      </button>
      <button type="button" onClick={() => switchSession("missing")}>
        Missing switch
      </button>
      <button type="button" onClick={logout}>
        Logout
      </button>
    </div>
  );
}

describe("SessionProvider", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("logs in, switches, and logs out sessions", async () => {
    const user = userEvent.setup();
    saveSession(buildSession({ apiBaseUrl: "", token: "admin-token", subject: "admin" }));
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>
    );

    expect(screen.getByText("admin")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Login editor" }));
    expect(screen.getByText("editor")).toBeInTheDocument();
    expect(screen.getByText("2 sessions")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Switch" }));
    expect(screen.getByText("admin")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Missing switch" }));
    expect(screen.getByText("editor")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("handles logout without an active session", async () => {
    const user = userEvent.setup();
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>
    );

    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(screen.getByText("none")).toBeInTheDocument();
  });
});
