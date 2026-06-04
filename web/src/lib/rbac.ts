export type ConsoleRole = "viewer" | "editor" | "admin";

export function getConsoleRole(): ConsoleRole {
  const role = import.meta.env.VITE_LEDGERFLOW_ROLE;
  return role === "viewer" || role === "editor" || role === "admin" ? role : "admin";
}

export function canWrite(role = getConsoleRole()): boolean {
  return role === "editor" || role === "admin";
}
