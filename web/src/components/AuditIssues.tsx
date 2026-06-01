import type { z } from "zod";

import type { auditReportSchema } from "../lib/schemas";

type AuditReport = z.infer<typeof auditReportSchema>;

export function AuditIssues({ report }: { report: AuditReport }) {
  const errors = report.issues.filter((issue) => issue.severity === "error");
  const warnings = report.issues.filter((issue) => issue.severity === "warning");

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold">Audit result</h3>
        <span className={report.summary.valid ? "text-emerald-700" : "text-rose-700"}>
          {report.summary.valid ? "Valid" : "Needs review"}
        </span>
      </div>
      <IssueGroup issues={errors} title={`Errors (${errors.length})`} />
      <IssueGroup issues={warnings} title={`Warnings (${warnings.length})`} />
    </section>
  );
}

function IssueGroup({ title, issues }: { title: string; issues: AuditReport["issues"] }) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      {issues.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">None</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {issues.map((issue) => (
            <li className="rounded-md border border-slate-200 p-3 text-sm" key={`${issue.code}-${issue.message}`}>
              <p className="font-medium">{issue.code}</p>
              <p className="mt-1 text-slate-600">{issue.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
