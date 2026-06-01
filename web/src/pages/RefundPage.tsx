import { useState } from "react";

import { TraceTree } from "../components/TraceTree";
import { FieldRow } from "../components/forms/FieldRow";
import { ApiError } from "../lib/apiClient";
import { formatMinor, parseMajorToMinor } from "../lib/money";
import { invoiceSchema } from "../lib/schemas";
import { useRefundSimulation } from "../hooks/useRefund";

const sampleInvoice = {
  currency: "USD",
  lineItems: [
    { id: "base", description: "Base subscription", amountMinor: 5000, currency: "USD", traceId: "base" },
    { id: "usage", description: "API usage", amountMinor: 1800, currency: "USD", traceId: "usage" }
  ],
  discounts: [],
  creditsApplied: [],
  taxLines: [{ jurisdiction: "US-CA", rate: 0.0825, amountMinor: 561, inclusive: false }],
  totals: { subtotal: 6800, discountTotal: 0, creditTotal: 0, tax: 561, total: 7361 },
  explanation: {
    id: "invoice",
    rule: "invoice_total",
    total: 7361,
    children: [
      { id: "base", rule: "flat_component", total: 5000 },
      { id: "usage", rule: "usage_component", total: 1800 }
    ]
  }
};

export function RefundPage() {
  const refund = useRefundSimulation();
  const [invoiceJson, setInvoiceJson] = useState(() => JSON.stringify(sampleInvoice, null, 2));
  const [amount, setAmount] = useState("25.00");
  const [strategy, setStrategy] = useState<"proportional" | "sequential">("proportional");
  const [formError, setFormError] = useState<string | null>(null);

  function simulateRefund() {
    try {
      setFormError(null);
      const invoice = invoiceSchema.parse(JSON.parse(invoiceJson));
      refund.mutate({
        invoice,
        amountMinor: parseMajorToMinor(amount),
        strategy
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Invalid refund input");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Refund simulator</h1>
        <p className="text-sm text-slate-600">Allocate partial refunds across invoice line items with traceability.</p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
          <FieldRow label="Invoice JSON">
            <textarea
              className="min-h-96 rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              value={invoiceJson}
              onChange={(event) => setInvoiceJson(event.target.value)}
            />
          </FieldRow>
        </div>
        <div className="space-y-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <FieldRow label="Refund amount">
            <input className="rounded-md border border-slate-300 px-3 py-2" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </FieldRow>
          <FieldRow label="Strategy">
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as "proportional" | "sequential")}
            >
              <option value="proportional">Proportional</option>
              <option value="sequential">Sequential</option>
            </select>
          </FieldRow>
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={simulateRefund}>
            Simulate refund
          </button>
          {formError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{formError}</p> : null}
          {refund.error ? (
            <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
              {refund.error instanceof ApiError ? `${refund.error.code}: ${refund.error.message}` : "Unexpected refund error"}
            </p>
          ) : null}
        </div>
      </section>

      {refund.data ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <div className="rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold text-slate-950">Allocations</h2>
              <p className="text-sm text-slate-600">
                Credit note: {formatMinor(refund.data.creditNote.amountMinor, refund.data.creditNote.currency)}
              </p>
            </div>
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Line item</th>
                  <th className="px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {refund.data.allocations.map((allocation) => (
                  <tr key={allocation.lineItemId}>
                    <td className="px-4 py-3 font-medium text-slate-950">{allocation.lineItemId}</td>
                    <td className="px-4 py-3 font-mono">
                      {formatMinor(allocation.amountMinor, refund.data.creditNote.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TraceTree trace={refund.data.trace} currency={refund.data.creditNote.currency} />
        </section>
      ) : null}
    </div>
  );
}
