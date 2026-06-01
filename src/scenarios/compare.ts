import { auditInvoice } from "../audit/invoice-auditor.js";
import { InvoiceEngine } from "../engine/InvoiceEngine.js";
import { parseBillingContext } from "../engine/context.js";
import type { ScenarioComparison, ScenarioDelta, ScenarioInput, ScenarioResult } from "./types.js";

export function compareScenarios(
  baseline: ScenarioInput,
  candidates: ScenarioInput[],
  engine = new InvoiceEngine()
): ScenarioComparison {
  if (candidates.length === 0) {
    throw new Error("Scenario comparison requires at least one candidate");
  }

  const baselineResult = simulateScenario(baseline, engine);
  const candidateResults = candidates.map((candidate) => simulateScenario(candidate, engine));

  return {
    baseline: baselineResult,
    candidates: candidateResults,
    deltas: candidateResults.map((candidate) => deltaBetween(baselineResult, candidate))
  };
}

function simulateScenario(input: ScenarioInput, engine: InvoiceEngine): ScenarioResult {
  if (!input.name.trim()) {
    throw new Error("Scenario name is required");
  }
  const context = parseBillingContext(input.context);
  const invoice = engine.simulate(context);
  return {
    name: input.name,
    invoice,
    audit: auditInvoice(invoice)
  };
}

function deltaBetween(baseline: ScenarioResult, candidate: ScenarioResult): ScenarioDelta {
  return {
    from: baseline.name,
    to: candidate.name,
    subtotalDelta: candidate.invoice.totals.subtotal - baseline.invoice.totals.subtotal,
    discountDelta: candidate.invoice.totals.discountTotal - baseline.invoice.totals.discountTotal,
    creditDelta: candidate.invoice.totals.creditTotal - baseline.invoice.totals.creditTotal,
    taxDelta: candidate.invoice.totals.tax - baseline.invoice.totals.tax,
    totalDelta: candidate.invoice.totals.total - baseline.invoice.totals.total
  };
}
