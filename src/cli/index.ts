#!/usr/bin/env node
import { readFileSync } from "node:fs";

import { Command } from "commander";

import { buildServer } from "../api/server.js";
import { auditInvoice } from "../audit/invoice-auditor.js";
import { DEFAULT_PLANS } from "../catalog/defaults.js";
import { validateCoupon } from "../discounts/coupon.js";
import { defaultInvoiceEngine } from "../engine/InvoiceEngine.js";
import type { Invoice } from "../invoice/types.js";
import { allocateRefund } from "../refunds/allocate-refund.js";
import { compareScenarios } from "../scenarios/compare.js";
import { assertInvoiceFromFiles, formatAssertionReport } from "./assert.js";

const program = new Command();

program.name("ledgerflow").description("Deterministic billing simulation toolkit").version("0.1.0");

program
  .command("plans")
  .option("--pretty")
  .action((options: { pretty?: boolean }) => {
    writeJson(Object.values(DEFAULT_PLANS), options.pretty);
  });

program
  .command("simulate")
  .requiredOption("--input <file>")
  .option("--pretty")
  .option("--trace")
  .action((options: { input: string; pretty?: boolean; trace?: boolean }) => {
    const invoice = defaultInvoiceEngine.simulate(readJson(options.input));
    if (options.trace) {
      writeJson(invoice, options.pretty);
      return;
    }
    const withoutTrace: Partial<Invoice> = { ...invoice };
    delete withoutTrace.explanation;
    writeJson(withoutTrace, options.pretty);
  });

program
  .command("validate-coupon")
  .requiredOption("--code <code>")
  .requiredOption("--input <file>")
  .action((options: { code: string; input: string }) => {
    readJson(options.input);
    const coupons = {
      SAVE20: { code: "SAVE20", kind: "percent", value: 20, stackable: true },
      LESS500: { code: "LESS500", kind: "fixed", value: 500, stackable: true }
    } as const;
    const coupon = coupons[options.code as keyof typeof coupons];
    writeJson(coupon ? validateCoupon(coupon) : { valid: false, reason: "coupon_not_found" }, true);
  });

program
  .command("refund")
  .requiredOption("--invoice <file>")
  .requiredOption("--amount <amountMinor>")
  .requiredOption("--strategy <strategy>")
  .action((options: { invoice: string; amount: string; strategy: string }) => {
    if (options.strategy !== "proportional" && options.strategy !== "sequential") {
      throw new Error(`Unsupported refund strategy: ${options.strategy}`);
    }
    const invoice = readInvoiceInput(readJson(options.invoice));
    writeJson(allocateRefund(invoice, Number.parseInt(options.amount, 10), options.strategy), true);
  });

program
  .command("audit")
  .requiredOption("--invoice <file>")
  .option("--pretty")
  .action((options: { invoice: string; pretty?: boolean }) => {
    writeJson(auditInvoice(readInvoiceInput(readJson(options.invoice))), options.pretty);
  });

program
  .command("assert")
  .description("Assert that a billing context produces an exact expected invoice")
  .requiredOption("--context <file>")
  .requiredOption("--expected <file>")
  .action((options: { context: string; expected: string }) => {
    const result = assertInvoiceFromFiles(options.context, options.expected);
    if (result.matched) {
      console.log(formatAssertionReport(result));
      return;
    }
    console.error(formatAssertionReport(result));
    process.exitCode = 1;
  });

program
  .command("compare")
  .requiredOption("--baseline <file>")
  .requiredOption("--candidate <file...>")
  .option("--pretty")
  .action((options: { baseline: string; candidate: string[]; pretty?: boolean }) => {
    const baseline = {
      name: options.baseline,
      context: readJson(options.baseline)
    };
    const candidates = options.candidate.map((file) => ({
      name: file,
      context: readJson(file)
    }));
    writeJson(compareScenarios(baseline, candidates, defaultInvoiceEngine), options.pretty);
  });

program
  .command("serve")
  .option("--port <port>", "Port to listen on", "3000")
  .option("--api-token <token>", "Bearer token required for API requests")
  .action(async (options: { port: string; apiToken?: string }) => {
    const server = buildServer(
      {},
      {
        ...process.env,
        LEDGERFLOW_API_TOKEN: options.apiToken ?? process.env.LEDGERFLOW_API_TOKEN
      }
    );
    await server.listen({ host: "0.0.0.0", port: Number.parseInt(options.port, 10) });
  });

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ error: { code: "cli_error", message } }));
  process.exitCode = 1;
});

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function readInvoiceInput(input: unknown): Invoice {
  if (isInvoice(input)) {
    return input;
  }
  if (isRecord(input) && isInvoice(input.invoice)) {
    return input.invoice;
  }
  throw new Error("Refund input must be an invoice or an object with an invoice property");
}

function isInvoice(input: unknown): input is Invoice {
  return isRecord(input) && Array.isArray(input.lineItems) && isRecord(input.totals);
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function writeJson(value: unknown, pretty = false): void {
  console.log(JSON.stringify(value, null, pretty ? 2 : 0));
}
