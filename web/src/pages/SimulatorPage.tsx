import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FieldRow } from "../components/forms/FieldRow";
import { MoneyInput } from "../components/forms/MoneyInput";
import { PlanSelect } from "../components/forms/PlanSelect";
import { InvoiceView } from "../components/InvoiceView";
import { TraceTree } from "../components/TraceTree";
import { ApiError } from "../lib/apiClient";
import {
  buildBillingContext,
  defaultSimulatorValues,
  simulatorFormSchema,
  type SimulatorFormInput,
  type SimulatorFormValues
} from "../lib/simulator";
import { useSimulateInvoice } from "../hooks/useSimulateInvoice";

export function SimulatorPage() {
  const [preview, setPreview] = useState<unknown>();
  const simulation = useSimulateInvoice();
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<SimulatorFormInput, unknown, SimulatorFormValues>({
    resolver: zodResolver(simulatorFormSchema),
    defaultValues: defaultSimulatorValues
  });

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div>
        <h2 className="text-2xl font-semibold">Invoice Simulator</h2>
        <form
          className="mt-6 grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
          onSubmit={handleSubmit((values) => {
            const context = buildBillingContext(values);
            setPreview(context);
            simulation.mutate(context);
          })}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FieldRow label="Currency" error={errors.currency?.message}>
              <input className="rounded-md border border-slate-300 px-3 py-2" {...register("currency")} />
            </FieldRow>
            <FieldRow label="Customer ID" error={errors.customerId?.message}>
              <input className="rounded-md border border-slate-300 px-3 py-2" {...register("customerId")} />
            </FieldRow>
            <FieldRow label="Tax jurisdiction" error={errors.jurisdiction?.message}>
              <input className="rounded-md border border-slate-300 px-3 py-2" {...register("jurisdiction")} />
            </FieldRow>
            <FieldRow label="Plan" error={errors.planId?.message}>
              <PlanSelect {...register("planId")} />
            </FieldRow>
            <FieldRow label="Seats" error={errors.seats?.message}>
              <input className="rounded-md border border-slate-300 px-3 py-2" type="number" {...register("seats")} />
            </FieldRow>
            <FieldRow label="API calls" error={errors.apiCalls?.message}>
              <input className="rounded-md border border-slate-300 px-3 py-2" type="number" {...register("apiCalls")} />
            </FieldRow>
            <FieldRow label="Period start" error={errors.periodStart?.message}>
              <input className="rounded-md border border-slate-300 px-3 py-2" type="date" {...register("periodStart")} />
            </FieldRow>
            <FieldRow label="Period end" error={errors.periodEnd?.message}>
              <input className="rounded-md border border-slate-300 px-3 py-2" type="date" {...register("periodEnd")} />
            </FieldRow>
            <FieldRow label="Coupon code" error={errors.couponCode?.message}>
              <input className="rounded-md border border-slate-300 px-3 py-2" {...register("couponCode")} />
            </FieldRow>
            <FieldRow label="Pre-tax credit" error={errors.creditMajor?.message}>
              <MoneyInput {...register("creditMajor")} />
            </FieldRow>
          </div>
          <button className="w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="submit">
            {simulation.isPending ? "Simulating..." : "Simulate invoice"}
          </button>
        </form>
      </div>
      <div className="grid gap-4">
        {simulation.error ? (
          <section className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950">
            <h3 className="font-semibold">Simulation failed</h3>
            <p className="mt-1 text-sm">
              {simulation.error instanceof ApiError
                ? `${simulation.error.code}: ${simulation.error.message}`
                : "Unexpected error"}
            </p>
          </section>
        ) : null}
        {simulation.data ? (
          <>
            <InvoiceView invoice={simulation.data} />
            <TraceTree currency={simulation.data.currency} trace={simulation.data.explanation} />
          </>
        ) : null}
        <aside className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold">Context preview</h3>
          <pre className="mt-4 max-h-[34rem] overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">
            {JSON.stringify(preview ?? buildBillingContext(defaultSimulatorValues), null, 2)}
          </pre>
        </aside>
      </div>
    </section>
  );
}
