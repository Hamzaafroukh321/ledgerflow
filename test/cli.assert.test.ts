import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { assertInvoiceFromFiles, formatAssertionReport } from "../src/cli/assert.js";

const contextPath = join("examples", "invoice-basic.json");
const expectedPath = join("test", "golden", "fixtures", "invoice-basic.invoice.json");

describe("billing regression assert", () => {
  it("matches a golden invoice fixture exactly", () => {
    const result = assertInvoiceFromFiles(contextPath, expectedPath);

    expect(result.matched).toBe(true);
    expect(result.diff).toEqual([]);
    expect(formatAssertionReport(result)).toBe("Billing assertion matched expected invoice.");
  });

  it("formats a readable drift report for invoice mismatches", () => {
    const directory = mkdtempSync(join(tmpdir(), "ledgerflow-assert-"));
    const expected = JSON.parse(readFileSync(expectedPath, "utf8")) as {
      totals: { total: number };
    };
    expected.totals.total += 1;
    const changedPath = join(directory, "changed.invoice.json");
    writeFileSync(changedPath, JSON.stringify(expected, null, 2));

    const result = assertInvoiceFromFiles(contextPath, changedPath);

    expect(result.matched).toBe(false);
    expect(formatAssertionReport(result)).toContain("$.totals.total: expected 2901, actual 2900");
    rmSync(directory, { recursive: true, force: true });
  });

  it("returns exit code 0 for matches and 1 for drift through the CLI", () => {
    const directory = mkdtempSync(join(tmpdir(), "ledgerflow-assert-cli-"));
    const expected = JSON.parse(readFileSync(expectedPath, "utf8")) as {
      totals: { total: number };
    };
    expected.totals.total += 100;
    const changedPath = join(directory, "changed.invoice.json");
    writeFileSync(changedPath, JSON.stringify(expected, null, 2));

    const match = runCliAssert(expectedPath);
    const drift = runCliAssert(changedPath);

    expect(match.status).toBe(0);
    expect(match.stdout).toContain("matched expected invoice");
    expect(drift.status).toBe(1);
    expect(drift.stderr).toContain("Billing assertion drift detected");
    expect(drift.stderr).toContain("$.totals.total: expected 3000, actual 2900");
    rmSync(directory, { recursive: true, force: true });
  });

  it("ships a usable Action wrapper and example workflow", () => {
    const action = readFileSync("action.yml", "utf8");
    const workflow = readFileSync(join("examples", "ci", "github-workflow.yml"), "utf8");

    expect(action).toContain("using: composite");
    expect(action).toContain("node dist/cli/index.js assert");
    expect(action).toContain("${{ inputs.context }}");
    expect(action).toContain("${{ inputs.expected }}");
    expect(workflow).toContain("uses: ./");
    expect(workflow).toContain("context: examples/invoice-basic.json");
    expect(workflow).toContain("expected: test/golden/fixtures/invoice-basic.invoice.json");
  });
});

function runCliAssert(expected: string): ReturnType<typeof spawnSync> {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "src/cli/index.ts",
      "assert",
      "--context",
      contextPath,
      "--expected",
      expected
    ],
    { encoding: "utf8" }
  );
}
