import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { defaultInvoiceEngine, parseBillingContext } from "../src/index.js";

interface Result {
  example: string;
  iterations: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

const examples = [
  "invoice-basic.json",
  "invoice-usage.json",
  "invoice-proration.json",
  "invoice-coupon-stack.json",
  "invoice-tax-exempt.json",
  "invoice-inclusive-tax.json",
  "invoice-reverse-charge.json",
  "invoice-over-credit.json"
];

const iterations = Number(process.env.LEDGERFLOW_BENCH_ITERATIONS ?? "1000");
const warmup = Math.min(50, Math.max(1, Math.floor(iterations / 10)));

function loadExample(name: string) {
  const raw = readFileSync(join("examples", name), "utf8");
  return parseBillingContext(JSON.parse(raw));
}

function percentile(values: number[], percentileRank: number) {
  const index = Math.min(values.length - 1, Math.ceil(values.length * percentileRank) - 1);
  return values[index] ?? 0;
}

function runExample(example: string): Result {
  const context = loadExample(example);
  for (let index = 0; index < warmup; index += 1) {
    defaultInvoiceEngine.simulate(context);
  }

  const timings: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    defaultInvoiceEngine.simulate(context);
    timings.push(performance.now() - start);
  }

  timings.sort((left, right) => left - right);
  const total = timings.reduce((sum, value) => sum + value, 0);
  return {
    example,
    iterations,
    avgMs: total / timings.length,
    p95Ms: percentile(timings, 0.95),
    maxMs: timings[timings.length - 1] ?? 0
  };
}

const results = examples.map(runExample);
const slowest = results.reduce((current, result) => (result.p95Ms > current.p95Ms ? result : current), results[0]);

console.log(
  JSON.stringify(
    {
      iterations,
      slowestByP95: slowest?.example,
      results: results.map((result) => ({
        ...result,
        avgMs: Number(result.avgMs.toFixed(4)),
        p95Ms: Number(result.p95Ms.toFixed(4)),
        maxMs: Number(result.maxMs.toFixed(4))
      }))
    },
    null,
    2
  )
);
