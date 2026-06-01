const workflows = [
  "Simulate invoices from billing context",
  "Audit reconciliation and trace totals",
  "Compare pricing scenarios",
  "Operate customers, usage, and refunds"
];

export function OverviewPage() {
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Explain every invoice before it ships.</h2>
        <p className="mt-4 max-w-3xl text-slate-600">
          LedgerFlow gives billing and RevOps teams a deterministic console for simulating charges,
          inspecting traces, and validating the exact rules behind each total.
        </p>
      </div>
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold">Operator workflows</h3>
        <ul className="mt-4 space-y-3">
          {workflows.map((workflow) => (
            <li className="flex gap-3 text-sm text-slate-700" key={workflow}>
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
              <span>{workflow}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
