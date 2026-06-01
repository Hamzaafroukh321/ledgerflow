import type { TraceNode } from "./schemas";

export interface FlatTraceNode {
  id: string;
  rule: string;
  total: number;
  depth: number;
}

export function flattenTrace(node: TraceNode, depth = 0): FlatTraceNode[] {
  return [
    { id: node.id, rule: node.rule, total: node.total, depth },
    ...(node.children ?? []).flatMap((child) => flattenTrace(child, depth + 1))
  ];
}
