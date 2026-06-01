function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            LedgerFlow
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Billing operations console</h1>
        </header>
        <section className="grid flex-1 place-items-center">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold">Frontend shell ready</h2>
            <p className="mt-3 text-slate-600">
              The web app will connect operators to invoice simulation, audits,
              scenario comparisons, customers, usage, and refunds.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
