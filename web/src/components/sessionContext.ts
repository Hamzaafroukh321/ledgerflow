import { createContext, useContext } from "react";

import type { ConsoleSession } from "../lib/session";

export interface SessionContextValue {
  session?: ConsoleSession;
  sessions: ConsoleSession[];
  login: (session: ConsoleSession) => void;
  switchSession: (sessionId: string) => void;
  logout: () => void;
}

export const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return value;
}
