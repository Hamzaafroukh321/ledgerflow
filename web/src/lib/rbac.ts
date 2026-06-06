import { readActiveSession } from "./session";

export type ConsoleRole = "viewer" | "editor" | "admin";

export function getConsoleRole(): ConsoleRole {
  const sessionRole = readActiveSession()?.role;
  if (sessionRole) {
    return sessionRole;
  }
  const role = import.meta.env.VITE_LEDGERFLOW_ROLE;
  return role === "viewer" || role === "editor" || role === "admin" ? role : "admin";
}

export function canWrite(role = getConsoleRole()): boolean {
  return role === "editor" || role === "admin";
}
