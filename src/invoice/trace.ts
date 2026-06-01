export interface TraceNode {
  id: string;
  rule: string;
  total: number;
  inputs?: Record<string, unknown>;
  children: TraceNode[];
}

export function traceNode(input: {
  id: string;
  rule: string;
  total: number;
  inputs?: Record<string, unknown>;
  children?: TraceNode[];
}): TraceNode {
  const node: TraceNode = {
    id: input.id,
    rule: input.rule,
    total: input.total,
    children: input.children ?? []
  };
  if (input.inputs !== undefined) {
    node.inputs = input.inputs;
  }
  return node;
}

export function reconcile(trace: TraceNode): boolean {
  if (trace.children.length === 0) {
    return Number.isInteger(trace.total);
  }

  const childTotal = trace.children.reduce((sum, child) => {
    return sum + child.total;
  }, 0);

  return childTotal === trace.total && trace.children.every((child) => reconcile(child));
}
