import { ApiError } from "../lib/apiClient";
import { canWrite } from "../lib/rbac";
import { useCouponsPage } from "../hooks/useCoupons";
import { useCreatePlan, usePlansPage } from "../hooks/usePlans";
import { formatMinor } from "../lib/money";
import { useState } from "react";

const defaultPlanJson = JSON.stringify(
  {
    id: "growth_monthly",
    name: "Growth Monthly",
    type: "per_seat",
    currency: "USD",
    components: [
      {
        id: "seat",
        name: "Seat",
        type: "per_seat",
        currency: "USD",
        unitAmountMinor: 4900
      }
    ]
  },
  null,
  2
);

export function PlansPage() {
  const plans = usePlansPage();
  const coupons = useCouponsPage();
  const createPlan = useCreatePlan();
  const [planJson, setPlanJson] = useState(defaultPlanJson);
  const [parseError, setParseError] = useState<string>();
  const writesAllowed = canWrite();

  function savePlan() {
    setParseError(undefined);
    let plan: unknown;
    try {
      plan = JSON.parse(planJson);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Invalid JSON");
      return;
    }
    createPlan.mutate(plan);
  }

  if (plans.isLoading || coupons.isLoading) {
    return <p className="text-slate-600">Loading plans...</p>;
  }

  if (plans.error || coupons.error) {
    const sourceError = plans.error ?? coupons.error;
    const error = sourceError instanceof ApiError ? sourceError : undefined;
    return (
      <section className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950">
        <h2 className="font-semibold">Plans could not be loaded</h2>
        <p className="mt-1 text-sm">
          {error ? `${error.code}: ${error.message}` : "Unexpected error"}
        </p>
      </section>
    );
  }

  const catalog = plans.data?.data ?? [];
  const couponCatalog = coupons.data?.data ?? [];
  const totalPlans = plans.data?.page.total ?? catalog.length;
  const totalCoupons = coupons.data?.page.total ?? couponCatalog.length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Catalog</h2>
          <p className="mt-2 text-slate-600">
            Tenant-scoped plans and coupons exposed by the API.
          </p>
        </div>
        <p className="text-sm font-medium text-slate-500">
          {totalPlans} plans / {totalCoupons} coupons
        </p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {writesAllowed ? (
          <div className="space-y-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-950">Create or update plan</h3>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Plan JSON
              <textarea
                className="min-h-[18rem] rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                value={planJson}
                onChange={(event) => setPlanJson(event.target.value)}
              />
            </label>
            <button
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={createPlan.isPending}
              type="button"
              onClick={savePlan}
            >
              {createPlan.isPending ? "Saving..." : "Save plan"}
            </button>
            <StatusMessage
              error={parseError ?? createPlan.error}
              success={createPlan.data ? `Saved ${createPlan.data.id}` : undefined}
            />
          </div>
        ) : null}

        <aside className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-950">Plan shape</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-slate-700">Required</dt>
              <dd className="text-slate-600">id, name, type, currency, components</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Types</dt>
              <dd className="text-slate-600">flat, per_seat, tiered, volume, graduated, usage</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Persistence</dt>
              <dd className="text-slate-600">
                Saved plans survive restarts when SQLite is enabled.
              </dd>
            </div>
          </dl>
        </aside>
      </section>

      {catalog.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No plans are available in this LedgerFlow environment.
        </p>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-950">Plan catalog</h3>
            <PaginationControls
              nextCursor={plans.nextCursor}
              onFirst={() => plans.setCursor(undefined)}
              onNext={() => plans.setCursor(plans.nextCursor ?? undefined)}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {catalog.map((plan) => (
              <article
                className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
                key={plan.id}
              >
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
                  <div className="col-span-2">
                    <dt className="text-slate-500">Starting price</dt>
                    <dd className="font-medium">
                      {formatMinor(plan.components[0]?.unitAmountMinor ?? 0, plan.currency)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-950">Coupon catalog</h3>
            <PaginationControls
              nextCursor={coupons.nextCursor}
              onFirst={() => coupons.setCursor(undefined)}
              onNext={() => coupons.setCursor(coupons.nextCursor ?? undefined)}
            />
          </div>
          <div className="space-y-3">
            {couponCatalog.map((coupon) => (
              <article
                className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
                key={coupon.code}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{coupon.code}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {coupon.kind === "percent" ? `${coupon.value}% off` : `${coupon.value} minor units off`}
                    </p>
                  </div>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold uppercase text-emerald-700">
                    {coupon.stackable ? "stackable" : "exclusive"}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Redeemed</dt>
                    <dd className="font-medium">{coupon.redeemedCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Limit</dt>
                    <dd className="font-medium">{coupon.redemptionLimit ?? "none"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function PaginationControls({
  nextCursor,
  onFirst,
  onNext
}: {
  nextCursor?: string | null;
  onFirst: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
        type="button"
        onClick={onFirst}
      >
        First
      </button>
      <button
        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
        disabled={!nextCursor}
        type="button"
        onClick={onNext}
      >
        Next
      </button>
    </div>
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
