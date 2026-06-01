import type { ReactNode } from "react";

export function FieldRow({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
      {error ? <span className="text-sm font-normal text-rose-700">{error}</span> : null}
    </label>
  );
}
