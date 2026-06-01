import type { AppliedCredit, Credit, CreditPhase, CreditTrace } from "./types.js";

export function applyCredits(
  invoiceSubtotalMinor: number,
  credits: Credit[],
  phase: CreditPhase
): { applied: AppliedCredit[]; remainingCredits: Credit[]; trace: CreditTrace } {
  if (!Number.isInteger(invoiceSubtotalMinor) || invoiceSubtotalMinor < 0) {
    throw new Error("Invoice subtotal must be a non-negative integer minor-unit value");
  }

  let remainingBalance = invoiceSubtotalMinor;
  const applied: AppliedCredit[] = [];
  const remainingCredits: Credit[] = [];
  const children: CreditTrace[] = [];

  for (const credit of credits) {
    validateCredit(credit);
    if (credit.phase !== phase || remainingBalance === 0) {
      remainingCredits.push({ ...credit });
      continue;
    }

    const amountApplied = Math.min(credit.amountMinor, remainingBalance);
    remainingBalance -= amountApplied;
    applied.push({ id: credit.id, amountMinor: -amountApplied, phase });
    children.push(traceNode(`credit-${credit.id}`, "apply_credit", -amountApplied, { creditId: credit.id }));

    const leftover = credit.amountMinor - amountApplied;
    if (leftover > 0) {
      remainingCredits.push({ ...credit, amountMinor: leftover });
    }
  }

  const total = applied.reduce((sum, credit) => sum + credit.amountMinor, 0);
  return {
    applied,
    remainingCredits,
    trace: {
      ...traceNode(`credits-${phase}`, "credit_application", total, {
        phase,
        invoiceSubtotalMinor
      }),
      children
    }
  };
}

function validateCredit(credit: Credit): void {
  if (!credit.id) {
    throw new Error("Credit requires an id");
  }
  if (!Number.isInteger(credit.amountMinor) || credit.amountMinor <= 0) {
    throw new Error("Credit amount must be a positive integer minor-unit value");
  }
}

function traceNode(
  id: string,
  rule: string,
  total: number,
  inputs: Record<string, unknown>
): CreditTrace {
  return { id, rule, total, inputs, children: [] };
}
