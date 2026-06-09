import { useMemo, useState, type ReactNode } from "react";

import {
  clearActiveSession,
  readActiveSession,
  readStoredSessions,
  removeStoredSession,
  saveSession,
  setActiveSession,
} from "../lib/session";
import { SessionContext, type SessionContextValue } from "./sessionContext";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState(readStoredSessions);
  const [session, setSession] = useState(readActiveSession);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      sessions,
      login: (nextSession) => {
        const nextSessions = saveSession(nextSession);
        setSessions(nextSessions);
        setSession(nextSession);
      },
      switchSession: (sessionId) => {
        setActiveSession(sessionId);
        const next = readStoredSessions();
        setSessions(next);
        setSession(next.find((candidate) => candidate.id === sessionId) ?? next[0]);
      },
      logout: () => {
        if (!session) {
          clearActiveSession();
          setSession(undefined);
          return;
        }
        const next = removeStoredSession(session.id);
        setSessions(next);
        setSession(next[0]);
      }
    }),
    [session, sessions]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
