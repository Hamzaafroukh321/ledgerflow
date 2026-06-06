import { z } from "zod";

export type ConsoleRole = "viewer" | "editor" | "admin";

export interface ConsoleSession {
  id: string;
  label: string;
  apiBaseUrl: string;
  token: string;
  tenantId: string;
  subject: string;
  role: ConsoleRole;
}

const storageKey = "ledgerflow.console.sessions";
const activeKey = "ledgerflow.console.activeSessionId";

const sessionSchema = z.object({
  id: z.string(),
  label: z.string(),
  apiBaseUrl: z.string(),
  token: z.string(),
  tenantId: z.string(),
  subject: z.string(),
  role: z.enum(["viewer", "editor", "admin"])
});

export const sessionsSchema = z.array(sessionSchema);

export function readStoredSessions(): ConsoleSession[] {
  if (typeof window === "undefined") {
    return envSession() ? [envSession() as ConsoleSession] : [];
  }
  const parsed = parseStoredSessions(window.localStorage.getItem(storageKey));
  const sessions = parsed.success ? parsed.data : [];
  const env = envSession();
  if (!env) {
    return sessions;
  }
  return sessions.some((session) => session.id === env.id) ? sessions : [env, ...sessions];
}

export function readActiveSession(): ConsoleSession | undefined {
  const sessions = readStoredSessions();
  if (sessions.length === 0) {
    return undefined;
  }
  if (typeof window === "undefined") {
    return sessions[0];
  }
  const activeId = window.localStorage.getItem(activeKey);
  return sessions.find((session) => session.id === activeId) ?? sessions[0];
}

export function saveSession(session: ConsoleSession): ConsoleSession[] {
  const sessions = readStoredSessions().filter((candidate) => candidate.id !== session.id);
  const next = [session, ...sessions];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    window.localStorage.setItem(activeKey, session.id);
  }
  return next;
}

export function setActiveSession(sessionId: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(activeKey, sessionId);
  }
}

export function clearActiveSession(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(activeKey);
  }
}

export function removeStoredSession(sessionId: string): ConsoleSession[] {
  const next = readStoredSessions().filter((session) => session.id !== sessionId);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    if (window.localStorage.getItem(activeKey) === sessionId) {
      window.localStorage.setItem(activeKey, next[0]?.id ?? "");
    }
  }
  return next;
}

export function buildSession(input: {
  apiBaseUrl: string;
  token: string;
  tenantId?: string;
  subject?: string;
  role?: ConsoleRole;
  label?: string;
}): ConsoleSession {
  const tokenDetails = parseTokenDetails(input.token);
  const tenantId = input.tenantId?.trim() || tokenDetails.tenantId || "default";
  const subject = input.subject?.trim() || tokenDetails.subject || "console-user";
  const role = input.role ?? tokenDetails.role ?? "admin";
  const apiBaseUrl = input.apiBaseUrl.trim().replace(/\/$/, "");
  const label = input.label?.trim() || tenantId;
  return {
    id: `${apiBaseUrl || "same-origin"}:${tenantId}:${subject}:${role}`,
    label,
    apiBaseUrl,
    token: input.token.trim(),
    tenantId,
    subject,
    role
  };
}

export function demoSession(apiBaseUrl = ""): ConsoleSession {
  return buildSession({
    apiBaseUrl,
    token: "",
    tenantId: "default",
    subject: "local-console",
    role: "admin",
    label: "Local demo"
  });
}

function parseTokenDetails(token: string): Partial<ConsoleSession> {
  const parts = token.split(":");
  const role = parts[3];
  return {
    tenantId: parts[1]?.trim() || undefined,
    subject: parts[2]?.trim() || undefined,
    role: role === "viewer" || role === "editor" || role === "admin" ? role : undefined
  };
}

function parseStoredSessions(raw: string | null) {
  if (!raw) {
    return { success: false as const };
  }
  try {
    return sessionsSchema.safeParse(JSON.parse(raw));
  } catch {
    return { success: false as const };
  }
}

function envSession(): ConsoleSession | undefined {
  const token = import.meta.env.VITE_LEDGERFLOW_API_TOKEN;
  if (!token) {
    return undefined;
  }
  return buildSession({
    apiBaseUrl: import.meta.env.VITE_LEDGERFLOW_API_BASE ?? "",
    token,
    tenantId: import.meta.env.VITE_LEDGERFLOW_TENANT_ID,
    subject: "env-console",
    role: import.meta.env.VITE_LEDGERFLOW_ROLE
  });
}
