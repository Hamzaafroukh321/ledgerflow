import { useMemo, useState } from "react";

import { FieldRow } from "../components/forms/FieldRow";
import { ApiError } from "../lib/apiClient";
import { useAggregateUsage, useIngestUsage, useUsageEvents } from "../hooks/useUsage";

export function UsagePage() {
  const events = useUsageEvents();
  const ingest = useIngestUsage();
  const aggregate = useAggregateUsage();
  const [customerId, setCustomerId] = useState("cus_acme");
  const [meter, setMeter] = useState("api_calls");
  const [quantity, setQuantity] = useState(250);
  const [timestamp, setTimestamp] = useState("2026-01-20T12:00:00.000Z");
  const [periodStart, setPeriodStart] = useState("2026-01-01");
  const [periodEnd, setPeriodEnd] = useState("2026-02-01");

  const totalQuantity = useMemo(() => (events.data ?? []).reduce((sum, event) => sum + event.quantity, 0), [events.data]);

  function ingestEvent() {
    ingest.mutate({
      idempotencyKey: `${customerId}:${meter}:${timestamp}`,
      customerId,
      meter,
      quantity,
      timestamp
    });
  }

  function aggregateEvents() {
    aggregate.mutate({
      customerId,
      period: { start: periodStart, end: periodEnd }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Usage explorer</h1>
          <p className="text-sm text-slate-600">Ingest metered usage, review events, and aggregate a billing period.</p>
        </div>
        <span className="text-sm font-medium text-slate-500">{totalQuantity} total units</span>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Ingest event</h2>
          <FieldRow label="Customer ID">
            <input className="rounded-md border border-slate-300 px-3 py-2" value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
          </FieldRow>
          <FieldRow label="Meter">
            <input className="rounded-md border border-slate-300 px-3 py-2" value={meter} onChange={(event) => setMeter(event.target.value)} />
          </FieldRow>
          <FieldRow label="Quantity">
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              min={0}
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </FieldRow>
          <FieldRow label="Timestamp">
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              value={timestamp}
              onChange={(event) => setTimestamp(event.target.value)}
            />
          </FieldRow>
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={ingestEvent}>
            Ingest usage
          </button>
          <StatusMessage error={ingest.error} success={ingest.data?.accepted ? "Usage accepted" : undefined} />
        </div>

        <div className="space-y-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Aggregate period</h2>
          <FieldRow label="Period start">
            <input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
          </FieldRow>
          <FieldRow label="Period end">
            <input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
          </FieldRow>
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={aggregateEvents}>
            Aggregate usage
          </button>
          <StatusMessage error={aggregate.error} />
          {aggregate.data ? (
            <dl className="grid gap-2 rounded-md bg-slate-50 p-4 text-sm">
              {Object.entries(aggregate.data).map(([name, value]) => (
                <div className="flex items-center justify-between gap-4" key={name}>
                  <dt className="font-medium text-slate-700">{name}</dt>
                  <dd className="font-mono text-slate-950">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-semibold text-slate-950">Events</h2>
          <span className="text-sm text-slate-500">{events.data?.length ?? 0} events</span>
        </div>
        {events.isLoading ? <p className="mt-3 text-sm text-slate-600">Loading usage events...</p> : null}
        <StatusMessage error={events.error} />
        <div className="mt-4 overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Meter</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(events.data ?? []).map((event) => (
                <tr key={event.idempotencyKey}>
                  <td className="px-4 py-3 font-medium text-slate-950">{event.customerId}</td>
                  <td className="px-4 py-3">{event.meter}</td>
                  <td className="px-4 py-3 font-mono">{event.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">{event.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatusMessage({ error, success }: { error?: unknown; success?: string }) {
  if (error) {
    return (
      <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
        {error instanceof ApiError ? `${error.code}: ${error.message}` : "Unexpected usage error"}
      </p>
    );
  }
  if (success) {
    return <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>;
  }
  return null;
}
