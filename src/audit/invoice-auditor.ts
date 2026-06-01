import type { Invoice } from "../invoice/types.js";
import { reconcile } from "../invoice/trace.js";
import type { AuditIssue, InvoiceAuditReport } from "./types.js";

export function auditInvoice(invoice: Invoice, checkedAt = "deterministic"): InvoiceAuditReport {
  const issues: AuditIssue[] = [
    ...auditLineItems(invoice),
    ...auditDiscounts(invoice),
    ...auditCredits(invoice),
    ...auditTaxes(invoice),
    ...auditTotals(invoice),
    ...auditTrace(invoice)
  ];
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    summary: {
      valid: errorCount === 0,
      errorCount,
      warningCount,
      checkedAt
    },
    issues
  };
}

function auditLineItems(invoice: Invoice): AuditIssue[] {
  const issues: AuditIssue[] = [];
  invoice.lineItems.forEach((line, index) => {
    if (line.currency !== invoice.currency) {
      issues.push({
        code: "line_currency_mismatch",
        severity: "error",
        message: `Line item ${line.id} uses ${line.currency}, expected ${invoice.currency}`,
        path: `/lineItems/${index}/currency`
      });
    }
    if (!Number.isSafeInteger(line.amountMinor)) {
      issues.push({
        code: "line_amount_not_safe_integer",
        severity: "error",
        message: `Line item ${line.id} amount must be a safe integer`,
        path: `/lineItems/${index}/amountMinor`
      });
    }
  });
  return issues;
}

function auditDiscounts(invoice: Invoice): AuditIssue[] {
  const issues: AuditIssue[] = [];
  invoice.discounts.forEach((discount, index) => {
    if (discount.amountMinor > 0) {
      issues.push({
        code: "discount_positive_amount",
        severity: "error",
        message: `Discount ${discount.code} must reduce the invoice`,
        path: `/discounts/${index}/amountMinor`
      });
    }
  });
  return issues;
}

function auditCredits(invoice: Invoice): AuditIssue[] {
  const issues: AuditIssue[] = [];
  invoice.creditsApplied.forEach((credit, index) => {
    if (credit.amountMinor > 0) {
      issues.push({
        code: "credit_positive_amount",
        severity: "error",
        message: `Credit ${credit.id} must reduce the invoice`,
        path: `/creditsApplied/${index}/amountMinor`
      });
    }
  });
  return issues;
}

function auditTaxes(invoice: Invoice): AuditIssue[] {
  const issues: AuditIssue[] = [];
  invoice.taxLines.forEach((taxLine, index) => {
    if (taxLine.amountMinor < 0) {
      issues.push({
        code: "negative_tax_amount",
        severity: "error",
        message: `Tax line ${taxLine.jurisdiction} cannot be negative`,
        path: `/taxLines/${index}/amountMinor`
      });
    }
    if (taxLine.rate < 0) {
      issues.push({
        code: "negative_tax_rate",
        severity: "error",
        message: `Tax line ${taxLine.jurisdiction} cannot use a negative rate`,
        path: `/taxLines/${index}/rate`
      });
    }
  });
  return issues;
}

function auditTotals(invoice: Invoice): AuditIssue[] {
  const subtotal = sum(invoice.lineItems.map((line) => line.amountMinor));
  const discountTotal = sum(invoice.discounts.map((discount) => discount.amountMinor));
  const creditTotal = sum(invoice.creditsApplied.map((credit) => credit.amountMinor));
  const tax = sum(invoice.taxLines.map((taxLine) => taxLine.amountMinor));
  const chargeableTax = sum(
    invoice.taxLines.map((taxLine) => (taxLine.inclusive ? 0 : taxLine.amountMinor))
  );
  const total = Math.max(0, subtotal + discountTotal + creditTotal + chargeableTax);

  return [
    totalIssue("subtotal_mismatch", "/totals/subtotal", subtotal, invoice.totals.subtotal),
    totalIssue(
      "discount_total_mismatch",
      "/totals/discountTotal",
      discountTotal,
      invoice.totals.discountTotal
    ),
    totalIssue("credit_total_mismatch", "/totals/creditTotal", creditTotal, invoice.totals.creditTotal),
    totalIssue("tax_total_mismatch", "/totals/tax", tax, invoice.totals.tax),
    totalIssue("invoice_total_mismatch", "/totals/total", total, invoice.totals.total)
  ].filter((issue): issue is AuditIssue => issue !== undefined);
}

function auditTrace(invoice: Invoice): AuditIssue[] {
  const issues: AuditIssue[] = [];
  if (invoice.explanation.total !== invoice.totals.total) {
    issues.push({
      code: "trace_root_total_mismatch",
      severity: "error",
      message: "Explanation root total must match invoice total",
      path: "/explanation/total",
      expected: invoice.totals.total,
      actual: invoice.explanation.total
    });
  }
  if (!reconcile(invoice.explanation)) {
    issues.push({
      code: "trace_reconciliation_failed",
      severity: "error",
      message: "Explanation trace children must sum to each parent",
      path: "/explanation"
    });
  }
  return issues;
}

function totalIssue(
  code: string,
  path: string,
  expected: number,
  actual: number
): AuditIssue | undefined {
  if (expected === actual) {
    return undefined;
  }
  return {
    code,
    severity: "error",
    message: `${path} expected ${expected}, received ${actual}`,
    path,
    expected,
    actual
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
