export type AuditSeverity = "error" | "warning";

export interface AuditIssue {
  code: string;
  severity: AuditSeverity;
  message: string;
  path: string;
  expected?: number;
  actual?: number;
}

export interface AuditSummary {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  checkedAt: string;
}

export interface InvoiceAuditReport {
  summary: AuditSummary;
  issues: AuditIssue[];
}
