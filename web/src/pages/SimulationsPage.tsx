import { useMemo, useState } from "react";

import { InvoiceView } from "../components/InvoiceView";
import { TraceTree } from "../components/TraceTree";
import { FieldRow } from "../components/forms/FieldRow";
import { useCreateSimulation, useSimulation, useSimulationsPage } from "../hooks/useSimulations";
import { ApiError } from "../lib/apiClient";
import { buildBillingContext, defaultSimulatorValues } from "../lib/simulator";
import type { SimulationRun } from "../lib/schemas";

export function SimulationsPage() {
  const simulations = useSimulationsPage();
  const createSimulation = useCreateSimulation();
  const defaultContext = useMemo(() => buildBillingContext(defaultSimulatorValues), []);
  const [name, setName] = useState("Monthly invoice review");
  const [contextText, setContextText] = useState(() => JSON.stringify(defaultContext, null, 2));
  const [selectedId, setSelectedId] = useState<string>();
  const [parseError, setParseError] = useState<string>();

  const runs = simulations.data?.data ?? [];
  const selectedListRun = runs.find((run) => run.id === selectedId) ?? runs[0];
  const detail = useSimulation(selectedId ?? selectedListRun?.id);
  const selectedRun = detail.data ?? selectedListRun;
  const totalRuns = simulations.data?.page.total ?? runs.length;

  function saveRun() {
    setParseError(undefined);
    let context: unknown;
    try {
      context = JSON.parse(contextText);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Invalid JSON");
      return;
    }
    createSimulation.mutate(
      { name, context },
      {
        onSuccess: (run) => {
          setSelectedId(run.id);
        }
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Saved simulations</h1>
          <p className="text-sm text-slate-600">
            Save generated invoices with their source billing context for review and comparison.
          </p>
        </div>
        <span className="text-sm font-medium text-slate-500">{totalRuns} runs</span>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Create run</h2>
          <FieldRow label="Run name">
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FieldRow>
          <FieldRow label="Billing context JSON">
            <textarea
              className="min-h-[22rem] rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              value={contextText}
              onChange={(event) => setContextText(event.target.value)}
            />
          </FieldRow>
          <button
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={createSimulation.isPending}
            type="button"
            onClick={saveRun}
          >
            {createSimulation.isPending ? "Saving..." : "Save simulation"}
          </button>
          <StatusMessage
            error={parseError ?? createSimulation.error}
            success={createSimulation.data ? "Simulation saved" : undefined}
          />
        </div>

        <aside className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-semibold text-slate-950">Simulation library</h2>
            {simulations.isLoading ? (
              <span className="text-sm text-slate-500">Loading...</span>
            ) : null}
          </div>
          <StatusMessage error={simulations.error} />
          {runs.length === 0 && !simulations.isLoading ? (
            <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
              No saved simulations yet.
            </p>
          ) : null}
          <div className="space-y-3">
            {runs.map((run) => (
              <RunButton
                isSelected={run.id === selectedRun?.id}
                key={run.id}
                run={run}
                onSelect={() => setSelectedId(run.id)}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
              type="button"
              onClick={() => simulations.setCursor(undefined)}
            >
              First page
            </button>
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
              disabled={!simulations.nextCursor}
              type="button"
              onClick={() => simulations.setCursor(simulations.nextCursor ?? undefined)}
            >
              Next page
            </button>
          </div>
        </aside>
      </section>

      {selectedRun ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Selected run</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-slate-500">Run</dt>
                  <dd className="font-medium">{selectedRun.name}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Customer</dt>
                  <dd className="font-medium">{selectedRun.context.customer.id}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Plan</dt>
                  <dd className="font-medium">{selectedRun.context.subscription.planId}</dd>
                </div>
              </dl>
            </div>
            <InvoiceView invoice={selectedRun.invoice} />
          </div>
          <TraceTree
            currency={selectedRun.invoice.currency}
            trace={selectedRun.invoice.explanation}
          />
        </section>
      ) : null}
    </div>
  );
}

function RunButton({
  run,
  isSelected,
  onSelect
}: {
  run: SimulationRun;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={[
        "w-full rounded-md border p-4 text-left shadow-sm transition",
        isSelected
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-950 hover:border-slate-400"
      ].join(" ")}
      type="button"
      onClick={onSelect}
    >
      <span className="block font-semibold">{run.name}</span>
      <span
        className={["mt-1 block text-xs", isSelected ? "text-slate-200" : "text-slate-500"].join(
          " "
        )}
      >
        {run.createdAt}
      </span>
      <span className="mt-3 block font-mono text-sm">
        {run.invoice.currency} {run.invoice.totals.total}
      </span>
    </button>
  );
}

function StatusMessage({ error, success }: { error?: unknown; success?: string }) {
  if (error) {
    return (
      <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
        {error instanceof ApiError ? `${error.code}: ${error.message}` : String(error)}
      </p>
    );
  }
  if (success) {
    return <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>;
  }
  return null;
}
