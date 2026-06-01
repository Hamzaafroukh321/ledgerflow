import { ApiError } from "../lib/apiClient";
import { usePlans } from "../hooks/usePlans";

export function PlansPage() {
  const plans = usePlans();

  if (plans.isLoading) {
    return <p className="text-slate-600">Loading plans...</p>;
  }

  if (plans.error) {
    const error = plans.error instanceof ApiError ? plans.error : undefined;
    return (
      <section className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950">
        <h2 className="font-semibold">Plans could not be loaded</h2>
        <p className="mt-1 text-sm">{error ? `${error.code}: ${error.message}` : "Unexpected error"}</p>
      </section>
    );
  }

  if (!plans.data || plans.data.length === 0) {
    return (
      <section>
        <h2 className="text-2xl font-semibold">Plans</h2>
        <p className="mt-3 text-slate-600">No plans are available in this LedgerFlow environment.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Plans</h2>
          <p className="mt-2 text-slate-600">Catalog plans and pricing components exposed by the API.</p>
        </div>
        <p className="text-sm font-medium text-slate-500">{plans.data.length} plans</p>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {plans.data.map((plan) => (
          <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm" key={plan.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.id}</p>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-700">
                {plan.currency}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Model</dt>
                <dd className="font-medium">{plan.type}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Components</dt>
                <dd className="font-medium">{plan.components.length}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
