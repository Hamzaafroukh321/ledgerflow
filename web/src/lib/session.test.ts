import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildSession,
  clearActiveSession,
  demoSession,
  readActiveSession,
  readStoredSessions,
  removeStoredSession,
  saveSession,
  setActiveSession
} from "./session";

describe("console session storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    vi.unstubAllEnvs();
  });

  it("derives tenant, subject, and role from token-map style tokens", () => {
    expect(buildSession({ apiBaseUrl: "/api", token: "tok:tenant-a:user-a:viewer" })).toMatchObject({
      apiBaseUrl: "/api",
      tenantId: "tenant-a",
      subject: "user-a",
      role: "viewer"
    });
  });

  it("saves and switches active sessions", () => {
    const admin = buildSession({
      apiBaseUrl: "",
      token: "admin-token",
      tenantId: "default",
      subject: "admin",
      role: "admin"
    });
    const viewer = buildSession({
      apiBaseUrl: "",
      token: "viewer-token",
      tenantId: "default",
      subject: "viewer",
      role: "viewer"
    });

    saveSession(admin);
    saveSession(viewer);
    setActiveSession(admin.id);

    expect(readStoredSessions()).toHaveLength(2);
    expect(readActiveSession()).toMatchObject({ subject: "admin", role: "admin" });
  });

  it("creates a local demo session without a token", () => {
    expect(demoSession()).toMatchObject({
      label: "Local demo",
      tenantId: "default",
      subject: "local-console",
      role: "admin",
      token: ""
    });
  });

  it("ignores malformed stored session data", () => {
    window.localStorage.setItem("ledgerflow.console.sessions", "not-json");

    expect(readStoredSessions()).toEqual([]);
    expect(readActiveSession()).toBeUndefined();
  });

  it("falls back through default build-session fields", () => {
    expect(buildSession({ apiBaseUrl: "http://localhost:3000/", token: "plain" })).toMatchObject({
      apiBaseUrl: "http://localhost:3000",
      tenantId: "default",
      subject: "console-user",
      role: "admin",
      label: "default"
    });
  });

  it("preseeds an environment session when configured", () => {
    vi.stubEnv("VITE_LEDGERFLOW_API_TOKEN", "env-token");
    vi.stubEnv("VITE_LEDGERFLOW_API_BASE", "http://api.example");
    vi.stubEnv("VITE_LEDGERFLOW_TENANT_ID", "tenant-env");
    vi.stubEnv("VITE_LEDGERFLOW_ROLE", "editor");

    expect(readStoredSessions()[0]).toMatchObject({
      apiBaseUrl: "http://api.example",
      tenantId: "tenant-env",
      subject: "env-console",
      role: "editor"
    });
    saveSession(readStoredSessions()[0]);
    expect(readStoredSessions()).toHaveLength(1);
  });

  it("removes inactive sessions and clears active session keys", () => {
    const first = buildSession({ apiBaseUrl: "", token: "first", subject: "first" });
    const second = buildSession({ apiBaseUrl: "", token: "second", subject: "second" });
    saveSession(first);
    saveSession(second);
    setActiveSession(second.id);

    expect(removeStoredSession(first.id)).toHaveLength(1);
    expect(removeStoredSession(second.id)).toEqual([]);
    clearActiveSession();
    expect(readActiveSession()).toBeUndefined();
  });

  it("supports no-window execution paths", () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("VITE_LEDGERFLOW_API_TOKEN", "env-token");

    expect(readStoredSessions()).toHaveLength(1);
    expect(readActiveSession()).toMatchObject({ token: "env-token" });
    const session = buildSession({ apiBaseUrl: "", token: "server-token" });
    expect(saveSession(session)).toEqual([session, expect.objectContaining({ token: "env-token" })]);
    expect(() => setActiveSession(session.id)).not.toThrow();
    expect(() => clearActiveSession()).not.toThrow();
    expect(removeStoredSession(session.id)).toEqual([expect.objectContaining({ token: "env-token" })]);
  });

  it("returns empty sessions without window or env", () => {
    vi.stubGlobal("window", undefined);

    expect(readStoredSessions()).toEqual([]);
    expect(readActiveSession()).toBeUndefined();
  });
});
