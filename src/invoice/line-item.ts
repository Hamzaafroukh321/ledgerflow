import type { LineItem } from "./types.js";

export function createLineItem(input: {
  id: string;
  description: string;
  amountMinor: number;
  currency: string;
  traceId?: string;
}): LineItem {
  if (!Number.isInteger(input.amountMinor)) {
    throw new Error("Line item amount must be an integer minor-unit value");
  }

  return {
    id: input.id,
    description: input.description,
    amountMinor: input.amountMinor,
    currency: input.currency,
    traceId: input.traceId ?? `trace-${input.id}`
  };
}
