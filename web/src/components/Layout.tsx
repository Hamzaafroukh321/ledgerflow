import { Outlet } from "react-router-dom";

import { Nav } from "./Nav";
import { ReleaseFooter } from "./ReleaseFooter";
import { useSession } from "./sessionContext";
import { Toast } from "./Toast";

export function Layout() {
  const { logout, session, sessions, switchSession } = useSession();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                LedgerFlow
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Billing operations console</h1>
            </div>
            {session ? (
              <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 font-medium text-slate-700">
                  Tenant
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1"
                    value={session.id}
                    onChange={(event) => switchSession(event.target.value)}
                  >
                    {sessions.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.label}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="rounded-md bg-white px-2 py-1 font-semibold uppercase text-slate-600">
                  {session.role}
                </span>
                <button
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700"
                  type="button"
                  onClick={logout}
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
          <Nav />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
      <ReleaseFooter />
      <Toast />
    </div>
  );
}
