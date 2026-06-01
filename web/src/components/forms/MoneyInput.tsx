import { forwardRef, type ComponentPropsWithoutRef } from "react";

export const MoneyInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(function MoneyInput(
  props,
  ref
) {
  return (
    <input
      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
      inputMode="decimal"
      placeholder="0.00"
      ref={ref}
      {...props}
    />
  );
});
