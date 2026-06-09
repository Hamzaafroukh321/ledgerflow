import { readFileSync } from "node:fs";

import { BillingContextSchema } from "../engine/context.js";
import { defaultInvoiceEngine } from "../engine/InvoiceEngine.js";

export interface BillingAssertionResult {
  matched: boolean;
  diff: string[];
  actual: unknown;
  expected: unknown;
}

export function assertInvoiceFromFiles(contextPath: string, expectedPath: string): BillingAssertionResult {
  const context = BillingContextSchema.parse(readJson(contextPath));
  const expected = readJson(expectedPath);
  const actual = defaultInvoiceEngine.simulate(context);
  const diff = diffValues(stable(expected), stable(actual), "$");
  return {
    matched: diff.length === 0,
    diff,
    actual,
    expected
  };
}

export function formatAssertionReport(result: BillingAssertionResult): string {
  if (result.matched) {
    return "Billing assertion matched expected invoice.";
  }
  return ["Billing assertion drift detected:", ...result.diff].join("\n");
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function diffValues(expected: unknown, actual: unknown, path: string): string[] {
  if (Object.is(expected, actual)) {
    return [];
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    return diffArrays(expected, actual, path);
  }
  if (isRecord(expected) || isRecord(actual)) {
    return diffRecords(expected, actual, path);
  }
  return [`${path}: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`];
}

function diffArrays(expected: unknown, actual: unknown, path: string): string[] {
  if (!Array.isArray(expected) || !Array.isArray(actual)) {
    return [`${path}: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`];
  }
  const lines: string[] = [];
  if (expected.length !== actual.length) {
    lines.push(`${path}.length: expected ${expected.length}, actual ${actual.length}`);
  }
  const maxLength = Math.max(expected.length, actual.length);
  for (let index = 0; index < maxLength; index += 1) {
    lines.push(...diffValues(expected[index], actual[index], `${path}[${index}]`));
  }
  return lines;
}

function diffRecords(expected: unknown, actual: unknown, path: string): string[] {
  if (!isRecord(expected) || !isRecord(actual)) {
    return [`${path}: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`];
  }
  const lines: string[] = [];
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  for (const key of keys) {
    if (!(key in expected)) {
      lines.push(`${path}.${key}: unexpected ${JSON.stringify(actual[key])}`);
      continue;
    }
    if (!(key in actual)) {
      lines.push(`${path}.${key}: missing expected ${JSON.stringify(expected[key])}`);
      continue;
    }
    lines.push(...diffValues(expected[key], actual[key], `${path}.${key}`));
  }
  return lines;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stable(nested)])
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
