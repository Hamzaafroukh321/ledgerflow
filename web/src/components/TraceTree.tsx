import { useState } from "react";

import { formatMinor } from "../lib/money";
import type { TraceNode } from "../lib/schemas";

export function TraceTree({ trace, currency }: { trace: TraceNode; currency: string }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold">Explanation trace</h3>
      <div className="mt-4">
        <TraceTreeNode node={trace} currency={currency} />
      </div>
    </section>
  );
}

function TraceTreeNode({ node, currency }: { node: TraceNode; currency: string }) {
  const [open, setOpen] = useState(true);
  const children = node.children ?? [];
  const hasChildren = children.length > 0;

  return (
    <div className="border-l border-slate-200 pl-3">
      <div className="flex items-center justify-between gap-3 py-2">
        <button
          className="rounded-md px-2 py-1 text-left text-sm font-medium text-slate-900 hover:bg-slate-100"
          disabled={!hasChildren}
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {hasChildren ? (open ? "Collapse" : "Expand") : "Leaf"} {node.rule}
        </button>
        <span className="text-sm font-semibold">{formatMinor(node.total, currency)}</span>
      </div>
      {open && hasChildren ? (
        <div className="ml-4">
          {children.map((child) => (
            <TraceTreeNode currency={currency} key={child.id} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
