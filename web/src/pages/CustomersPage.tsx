import { useState } from "react";

import { FieldRow } from "../components/forms/FieldRow";
import { ApiError } from "../lib/apiClient";
import { useAssignSubscription, useBillingProfile, useCreateCustomer, useCustomers } from "../hooks/useCustomers";

const today = "2026-01-15";

export function CustomersPage() {
  const customers = useCustomers();
  const createCustomer = useCreateCustomer();
  const assignSubscription = useAssignSubscription();
  const billingProfile = useBillingProfile();
  const [id, setId] = useState("cus_acme");
  const [name, setName] = useState("Acme Finance");
  const [email, setEmail] = useState("billing@acme.example");
  const [jurisdiction, setJurisdiction] = useState("US-CA");
  const [planId, setPlanId] = useState("pro_monthly");
  const [seats, setSeats] = useState(5);
  const [onDate, setOnDate] = useState(today);

  const selectedCustomerId = customers.data?.[0]?.id ?? id;

  function create() {
    createCustomer.mutate({
      id,
      name,
      email: email.trim() ? email : undefined,
      taxProfile: { exempt: false, jurisdiction },
      metadata: { source: "web_console" }
    });
  }

  function assign() {
    assignSubscription.mutate({
      customerId: selectedCustomerId,
      planId,
      seats,
      startsOn: onDate
    });
  }

  function loadProfile() {
    billingProfile.mutate({ customerId: selectedCustomerId, onDate });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Customer console</h1>
        <p className="text-sm text-slate-600">Create billing customers, assign subscriptions, and inspect profiles.</p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Create customer</h2>
          <FieldRow label="Customer ID">
            <input className="rounded-md border border-slate-300 px-3 py-2" value={id} onChange={(event) => setId(event.target.value)} />
          </FieldRow>
          <FieldRow label="Name">
            <input className="rounded-md border border-slate-300 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} />
          </FieldRow>
          <FieldRow label="Email">
            <input className="rounded-md border border-slate-300 px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} />
          </FieldRow>
          <FieldRow label="Tax jurisdiction">
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value)}
            />
          </FieldRow>
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={create}>
            Create customer
          </button>
          <MutationError error={createCustomer.error} />
        </div>

        <div className="space-y-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Subscription and profile</h2>
          <FieldRow label="Plan ID">
            <input className="rounded-md border border-slate-300 px-3 py-2" value={planId} onChange={(event) => setPlanId(event.target.value)} />
          </FieldRow>
          <FieldRow label="Seats">
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              min={0}
              type="number"
              value={seats}
              onChange={(event) => setSeats(Number(event.target.value))}
            />
          </FieldRow>
          <FieldRow label="Profile date">
            <input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={onDate} onChange={(event) => setOnDate(event.target.value)} />
          </FieldRow>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={assign}>
              Assign subscription
            </button>
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" type="button" onClick={loadProfile}>
              Load billing profile
            </button>
          </div>
          <MutationError error={assignSubscription.error ?? billingProfile.error} />
          {billingProfile.data ? (
            <dl className="grid gap-3 rounded-md bg-slate-50 p-4 text-sm">
              <div>
                <dt className="text-slate-500">Profile customer</dt>
                <dd className="font-medium text-slate-950">{billingProfile.data.customer.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Active plan</dt>
                <dd className="font-medium text-slate-950">
                  {billingProfile.data.activeSubscription?.planId ?? "No active subscription"}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-semibold text-slate-950">Customers</h2>
          <span className="text-sm text-slate-500">{customers.data?.length ?? 0} records</span>
        </div>
        {customers.isLoading ? <p className="mt-3 text-sm text-slate-600">Loading customers...</p> : null}
        {customers.error ? <MutationError error={customers.error} /> : null}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {(customers.data ?? []).map((customer) => (
            <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" key={customer.id}>
              <h3 className="font-semibold text-slate-950">{customer.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{customer.id}</p>
              <p className="mt-3 text-sm text-slate-700">{customer.email ?? "No email"}</p>
              <p className="mt-1 text-xs font-semibold uppercase text-slate-500">{customer.taxProfile.jurisdiction}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function MutationError({ error }: { error: unknown }) {
  if (!error) {
    return null;
  }
  return (
    <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
      {error instanceof ApiError ? `${error.code}: ${error.message}` : "Unexpected customer console error"}
    </p>
  );
}
