import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuditIssues } from "./AuditIssues";

describe("AuditIssues", () => {
  it("groups audit issues by severity", () => {
    render(
      <AuditIssues
        report={{
          checkedAt: "now",
          summary: { valid: false, errors: 1, warnings: 1 },
          issues: [
            { code: "bad_total", severity: "error", message: "Total does not reconcile" },
            { code: "missing_id", severity: "warning", message: "Invoice has no ID" }
          ]
        }}
      />
    );

    expect(screen.getByText("Errors (1)")).toBeInTheDocument();
    expect(screen.getByText("Warnings (1)")).toBeInTheDocument();
    expect(screen.getByText("bad_total")).toBeInTheDocument();
  });
});
