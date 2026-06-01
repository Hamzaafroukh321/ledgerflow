import { forwardRef, type ComponentPropsWithoutRef } from "react";

const planOptions = [
  { id: "starter_monthly", name: "Starter Monthly" },
  { id: "pro_monthly", name: "Pro Monthly" }
];

export const PlanSelect = forwardRef<HTMLSelectElement, ComponentPropsWithoutRef<"select">>(function PlanSelect(
  props,
  ref
) {
  return (
    <select
      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
      ref={ref}
      {...props}
    >
      <option value="">Select a plan</option>
      {planOptions.map((plan) => (
        <option key={plan.id} value={plan.id}>
          {plan.name}
        </option>
      ))}
    </select>
  );
});
