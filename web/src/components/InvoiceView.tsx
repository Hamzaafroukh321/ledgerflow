import { formatMinor } from "../lib/money";
import type { Invoice } from "../lib/schemas";

export function InvoiceView({ invoice }: { invoice: Invoice }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Invoice</h3>
          <p className="mt-1 text-sm text-slate-500">{invoice.id ?? "Simulated invoice"}</p>
        </div>
        <p className="text-2xl font-semibold">{formatMinor(invoice.totals.total, invoice.currency)}</p>
      </div>
      <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((line) => (
              <tr className="border-t border-slate-200" key={line.id}>
                <td className="px-3 py-2">{line.description}</td>
                <td className="px-3 py-2 text-right">{formatMinor(line.amountMinor, line.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-5 grid gap-2 text-sm">
        <SummaryRow label="Subtotal" value={formatMinor(invoice.totals.subtotal, invoice.currency)} />
        <SummaryRow label="Discounts" value={formatMinor(invoice.totals.discountTotal, invoice.currency)} />
        <SummaryRow label="Credits" value={formatMinor(invoice.totals.creditTotal, invoice.currency)} />
        <SummaryRow label="Tax" value={formatMinor(invoice.totals.tax, invoice.currency)} />
      </dl>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
