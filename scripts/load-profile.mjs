import { performance } from "node:perf_hooks";
import process from "node:process";

const target = process.env.LEDGERFLOW_LOAD_URL ?? "http://127.0.0.1:3100/v1/invoices/simulate";
const token = process.env.LEDGERFLOW_LOAD_TOKEN ?? "";
const requests = readInt("LEDGERFLOW_LOAD_REQUESTS", 120);
const concurrency = readInt("LEDGERFLOW_LOAD_CONCURRENCY", 12);

const context = {
  currency: "USD",
  period: { start: "2026-01-01", end: "2026-02-01" },
  customer: { id: "cus_load", taxProfile: { exempt: true, jurisdiction: "US-CA" } },
  subscription: { planId: "pro_monthly", seats: 25, changedOn: null },
  usage: Array.from({ length: 40 }, (_, index) => ({
    meter: index % 2 === 0 ? "api_calls" : "storage_gb",
    quantity: 50 + index
  })),
  coupons: ["SAVE20", "LESS500"],
  credits: []
};

const started = performance.now();
const timings = [];
let ok = 0;
let failed = 0;
let next = 0;

await Promise.all(Array.from({ length: concurrency }, runWorker));

timings.sort((left, right) => left - right);
const elapsedSeconds = (performance.now() - started) / 1000;
const result = {
  target,
  requests,
  concurrency,
  ok,
  failed,
  rps: Number((ok / elapsedSeconds).toFixed(2)),
  latencyMs: {
    p50: percentile(timings, 0.5),
    p95: percentile(timings, 0.95),
    max: timings.at(-1) ?? 0
  }
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (failed > 0) {
  process.exitCode = 1;
}

async function runWorker() {
  for (;;) {
    const index = next;
    next += 1;
    if (index >= requests) {
      return;
    }
    await sendRequest();
  }
}

async function sendRequest() {
  const startedRequest = performance.now();
  try {
    const headers = { "content-type": "application/json" };
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    const response = await globalThis.fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify(context)
    });
    if (response.ok) {
      ok += 1;
    } else {
      failed += 1;
    }
    await response.arrayBuffer();
  } catch {
    failed += 1;
  } finally {
    timings.push(Number((performance.now() - startedRequest).toFixed(3)));
  }
}

function readInt(name, fallback) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(values, rank) {
  if (values.length === 0) {
    return 0;
  }
  const index = Math.min(values.length - 1, Math.ceil(values.length * rank) - 1);
  return values[index];
}
