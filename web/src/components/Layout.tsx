import { Outlet } from "react-router-dom";

import { Nav } from "./Nav";
import { Toast } from "./Toast";

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">LedgerFlow</p>
            <h1 className="mt-1 text-2xl font-semibold">Billing operations console</h1>
          </div>
          <Nav />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
      <Toast />
    </div>
  );
}
