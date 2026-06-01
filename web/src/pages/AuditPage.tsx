import { useState } from "react";

import { AuditIssues } from "../components/AuditIssues";
import { useAuditInvoice } from "../hooks/useAuditInvoice";
import { ApiError } from "../lib/apiClient";
import { invoiceSchema } from "../lib/schemas";

const sampleInvoice = {
  currency: "USD",
  lineItems: [{ id: "base", description: "Base subscription", amountMinor: 1000, currency: "USD", traceId: "base" }],
  discounts: [],
  creditsApplied: [],
  taxLines: [],
  totals: { subtotal: 1000, discountTotal: 0, creditTotal: 0, tax: 0, total: 1000 },
  explanation: { id: "root", rule: "invoice_total", total: 1000 }
};

export function AuditPage() {
  const [invoiceJson, setInvoiceJson] = useState(JSON.stringify(sampleInvoice, null, 2));
  const [parseError, setParseError] = useState<string>();
  const audit = useAuditInvoice();

  function submit() {
    setParseError(undefined);
    try {
      audit.mutate(invoiceSchema.parse(JSON.parse(invoiceJson)));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div>
        <h2 className="text-2xl font-semibold">Audit Panel</h2>
        <textarea
          className="mt-6 min-h-[28rem] w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-sm shadow-sm"
          onChange={(event) => setInvoiceJson(event.target.value)}
          value={invoiceJson}
        />
        <button className="mt-4 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={submit} type="button">
          Audit invoice
        </button>
      </div>
      <div className="grid gap-4">
        {parseError ? <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">{parseError}</p> : null}
        {audit.error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
            {audit.error instanceof ApiError ? `${audit.error.code}: ${audit.error.message}` : "Unexpected error"}
          </p>
        ) : null}
        {audit.data ? <AuditIssues report={audit.data} /> : null}
      </div>
    </section>
  );
}
