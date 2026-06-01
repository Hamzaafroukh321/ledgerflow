import { allocate } from "../money/allocate.js";
import { Money } from "../money/Money.js";
import type { Invoice } from "../invoice/types.js";
import type { CreditNote, RefundAllocation, RefundStrategy, RefundTrace } from "./types.js";

export function allocateRefund(
  invoice: Invoice,
  refundAmountMinor: number,
  strategy: RefundStrategy
): { allocations: RefundAllocation[]; creditNote: CreditNote; trace: RefundTrace } {
  if (!Number.isInteger(refundAmountMinor) || refundAmountMinor <= 0) {
    throw new Error("Refund amount must be a positive integer minor-unit value");
  }

  const refundable = invoice.lineItems.map((lineItem) => ({
    lineItemId: lineItem.id,
    remainingMinor: Math.max(0, lineItem.amountMinor)
  }));
  const maxRefund = refundable.reduce((sum, item) => sum + item.remainingMinor, 0);
  const target = Math.min(refundAmountMinor, maxRefund);
  const allocations =
    strategy === "proportional"
      ? allocateProportionally(invoice.currency, target, refundable)
      : allocateSequentially(target, refundable);

  const total = allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0);
  const creditNote: CreditNote = {
    amountMinor: total,
    allocations
  };
  if (invoice.id !== undefined) {
    creditNote.invoiceId = invoice.id;
  }
  return {
    allocations,
    creditNote,
    trace: {
      id: "refund",
      rule: `${strategy}_refund_allocation`,
      total,
      inputs: { requestedAmountMinor: refundAmountMinor },
      children: allocations.map((allocation) => ({
        id: `refund-${allocation.lineItemId}`,
        rule: "refund_line_item",
        total: allocation.amountMinor,
        inputs: { lineItemId: allocation.lineItemId },
        children: []
      }))
    }
  };
}

function allocateProportionally(
  currency: string,
  target: number,
  refundable: { lineItemId: string; remainingMinor: number }[]
): RefundAllocation[] {
  return allocate(
    new Money(target, currency),
    refundable.map((item) => item.remainingMinor)
  )
    .map((amount, index) => ({
      lineItemId: refundable[index]?.lineItemId ?? "",
      amountMinor: Math.min(amount.amountMinor, refundable[index]?.remainingMinor ?? 0)
    }))
    .filter((allocation) => allocation.amountMinor > 0);
}

function allocateSequentially(
  target: number,
  refundable: { lineItemId: string; remainingMinor: number }[]
): RefundAllocation[] {
  let remaining = target;
  const allocations: RefundAllocation[] = [];

  for (const item of refundable) {
    if (remaining === 0) {
      break;
    }
    const amountMinor = Math.min(remaining, item.remainingMinor);
    if (amountMinor > 0) {
      allocations.push({ lineItemId: item.lineItemId, amountMinor });
      remaining -= amountMinor;
    }
  }

  return allocations;
}
