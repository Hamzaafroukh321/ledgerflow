import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useSession } from "../components/sessionContext";
import { buildSession, demoSession, type ConsoleRole } from "../lib/session";

const roles: ConsoleRole[] = ["admin", "editor", "viewer"];

export function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [apiBaseUrl, setApiBaseUrl] = useState(import.meta.env.VITE_LEDGERFLOW_API_BASE ?? "");
  const [token, setToken] = useState(import.meta.env.VITE_LEDGERFLOW_API_TOKEN ?? "");
  const [tenantId, setTenantId] = useState("default");
  const [subject, setSubject] = useState("console-user");
  const [role, setRole] = useState<ConsoleRole>("admin");

  function submit() {
    const session = buildSession({ apiBaseUrl, token, tenantId, subject, role });
    login(session);
    navigate("/", { replace: true });
  }

  function useDemo() {
    login(demoSession(apiBaseUrl));
    navigate("/", { replace: true });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="self-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            LedgerFlow
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight">
            Sign in to the billing operations console
          </h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            Connect a tenant-scoped API token, then inspect catalog changes, run simulations,
            and review saved invoice explanations from the same secured console.
          </p>
        </div>

        <form
          className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            API base URL
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="http://127.0.0.1:3000"
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            API token
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="token:tenant:subject:role"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Tenant
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Subject
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Role
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={role}
              onChange={(event) => setRole(event.target.value as ConsoleRole)}
            >
              {roles.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
              type="submit"
            >
              Sign in
            </button>
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              type="button"
              onClick={useDemo}
            >
              Use local demo
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
