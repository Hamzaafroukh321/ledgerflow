import { Navigate, Outlet } from "react-router-dom";

import { canWrite } from "../lib/rbac";
import { useSession } from "./sessionContext";

export function RequireSession() {
  const { session } = useSession();
  return session ? <Outlet /> : <Navigate replace to="/login" />;
}

export function RequireWriteRole({ children }: { children: JSX.Element }) {
  const { session } = useSession();
  if (!session) {
    return <Navigate replace to="/login" />;
  }
  return canWrite(session.role) ? children : <Navigate replace to="/" />;
}
