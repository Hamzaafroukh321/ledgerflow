import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSession, saveSession } from "./session";
import { canWrite, getConsoleRole } from "./rbac";

describe("console RBAC helpers", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
  });

  it("prefers the active session role", () => {
    saveSession(buildSession({ apiBaseUrl: "", token: "", tenantId: "default", role: "viewer" }));
    vi.stubEnv("VITE_LEDGERFLOW_ROLE", "admin");

    expect(getConsoleRole()).toBe("viewer");
    expect(canWrite()).toBe(false);
  });

  it("falls back to a valid env role or admin", () => {
    vi.stubEnv("VITE_LEDGERFLOW_ROLE", "editor");
    expect(getConsoleRole()).toBe("editor");
    expect(canWrite()).toBe(true);

    vi.stubEnv("VITE_LEDGERFLOW_ROLE", "invalid");
    expect(getConsoleRole()).toBe("admin");
  });
});
