import { useMemo, useState } from "react";

import { DeltaTable } from "../components/DeltaTable";
import { ApiError } from "../lib/apiClient";
import { billingContextSchema } from "../lib/schemas";
import { useCompareScenarios } from "../hooks/useCompareScenarios";

const baselineContext = {
  currency: "USD",
  period: { start: "2026-01-01", end: "2026-02-01" },
  customer: { id: "cus_1", taxProfile: { exempt: false, jurisdiction: "US-CA" } },
  subscription: { planId: "starter_monthly", seats: 3 },
  usage: [{ meter: "api_calls", quantity: 1200 }],
  coupons: [],
  credits: []
};

const candidateContext = {
  ...baselineContext,
  subscription: { planId: "pro_monthly", seats: 3 },
  usage: [{ meter: "api_calls", quantity: 2400 }],
  coupons: ["SAVE20"]
};

export function ScenarioPage() {
  const compare = useCompareScenarios();
  const [baselineName, setBaselineName] = useState("Starter baseline");
  const [candidateName, setCandidateName] = useState("Pro candidate");
  const [baselineJson, setBaselineJson] = useState(() => JSON.stringify(baselineContext, null, 2));
  const [candidateJson, setCandidateJson] = useState(() => JSON.stringify(candidateContext, null, 2));
  const [formError, setFormError] = useState<string | null>(null);

  const rows = useMemo(() => compare.data?.deltas.length ?? 0, [compare.data]);

  function submitComparison() {
    try {
      setFormError(null);
      const baseline = billingContextSchema.parse(JSON.parse(baselineJson));
      const candidate = billingContextSchema.parse(JSON.parse(candidateJson));
      compare.mutate({
        baseline: { name: baselineName, context: baseline },
        candidates: [{ name: candidateName, context: candidate }]
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Invalid scenario payload");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Scenario comparison</h1>
          <p className="text-sm text-slate-600">Compare totals, audit state, and pricing movement across contexts.</p>
        </div>
        {compare.data ? <span className="text-sm font-medium text-slate-600">{rows} candidate delta</span> : null}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Baseline name</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={baselineName}
            onChange={(event) => setBaselineName(event.target.value)}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Candidate name</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={candidateName}
            onChange={(event) => setCandidateName(event.target.value)}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Baseline context JSON</span>
          <textarea
            className="min-h-80 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
            value={baselineJson}
            onChange={(event) => setBaselineJson(event.target.value)}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Candidate context JSON</span>
          <textarea
            className="min-h-80 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
            value={candidateJson}
            onChange={(event) => setCandidateJson(event.target.value)}
          />
        </label>
      </section>

      <button
        className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        type="button"
        disabled={compare.isPending}
        onClick={submitComparison}
      >
        {compare.isPending ? "Comparing..." : "Compare scenarios"}
      </button>

      {formError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{formError}</p> : null}
      {compare.error ? (
        <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
          {compare.error instanceof ApiError
            ? `${compare.error.code}: ${compare.error.message}`
            : "Unexpected comparison error"}
        </p>
      ) : null}
      {compare.data ? <DeltaTable comparison={compare.data} /> : null}
    </div>
  );
}
