import type { ScenarioComparison } from "../lib/schemas";
import { signedMinor } from "../lib/money";
import { classifyDelta } from "../lib/scenarioDeltas";

type Delta = ScenarioComparison["deltas"][number];

const columns: Array<{ key: keyof Omit<Delta, "from" | "to">; label: string }> = [
  { key: "subtotalDelta", label: "Subtotal" },
  { key: "discountDelta", label: "Discounts" },
  { key: "creditDelta", label: "Credits" },
  { key: "taxDelta", label: "Tax" },
  { key: "totalDelta", label: "Total" }
];

export function DeltaTable({ comparison, currency }: { comparison: ScenarioComparison; currency?: string }) {
  const displayCurrency = currency ?? comparison.baseline.invoice.currency;
  const validityByCandidate = new Map(comparison.candidates.map((candidate) => [candidate.name, candidate.audit.summary.valid]));

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-500">Baseline</p>
        <h2 className="text-xl font-semibold text-slate-950">{comparison.baseline.name}</h2>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Candidate</th>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3">
                  {column.label}
                </th>
              ))}
              <th className="px-4 py-3">Validity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comparison.deltas.map((delta) => (
              <tr key={`${delta.from}-${delta.to}`}>
                <td className="px-4 py-3 font-medium text-slate-900">{delta.to}</td>
                {columns.map((column) => {
                  const value = delta[column.key];
                  const tone = classifyDelta(value);
                  return (
                    <td
                      key={column.key}
                      className={`px-4 py-3 font-mono ${
                        tone === "positive"
                          ? "text-emerald-700"
                          : tone === "negative"
                            ? "text-rose-700"
                            : "text-slate-600"
                      }`}
                    >
                      {signedMinor(value, displayCurrency)}
                    </td>
                  );
                })}
                <td className="px-4 py-3">
                  {validityByCandidate.get(delta.to) !== comparison.baseline.audit.summary.valid ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                      Changed
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      Stable
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
