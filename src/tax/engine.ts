import type { TaxableLineItem, TaxLine, TaxProfile, TaxTrace } from "./types.js";

const DEFAULT_RATES: Record<string, number> = {
  "US-CA": 0.0725,
  "US-NY": 0.08875,
  GB: 0.2,
  DE: 0.19
};

export function computeTax(
  lineItems: TaxableLineItem[],
  taxProfile: TaxProfile
): { taxLines: TaxLine[]; trace: TaxTrace } {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amountMinor, 0);

  if (taxProfile.exempt || taxProfile.reverseCharge || subtotal <= 0) {
    const reason = taxProfile.exempt ? "tax_exempt" : taxProfile.reverseCharge ? "reverse_charge" : "zero";
    return {
      taxLines: [],
      trace: traceNode("tax", reason, 0, { jurisdiction: taxProfile.jurisdiction })
    };
  }

  const rate = taxProfile.rates?.[taxProfile.jurisdiction] ?? DEFAULT_RATES[taxProfile.jurisdiction] ?? 0;
  const inclusive = taxProfile.inclusive ?? false;
  const amountMinor = inclusive
    ? Math.round(subtotal - subtotal / (1 + rate))
    : Math.round(subtotal * rate);

  const taxLine: TaxLine = {
    jurisdiction: taxProfile.jurisdiction,
    rate,
    amountMinor,
    inclusive
  };

  return {
    taxLines: [taxLine],
    trace: traceNode("tax", inclusive ? "inclusive_tax" : "exclusive_tax", amountMinor, {
      jurisdiction: taxProfile.jurisdiction,
      subtotal,
      rate
    })
  };
}

function traceNode(id: string, rule: string, total: number, inputs: Record<string, unknown>): TaxTrace {
  return { id, rule, total, inputs, children: [] };
}
