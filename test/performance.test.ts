import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { buildServer, type BillingContext } from "../src/index.js";
import {
  MemorySimulationCache,
  simulationCacheKey
} from "../src/api/simulation-cache.js";
import { DEFAULT_COUPONS, DEFAULT_PLANS } from "../src/catalog/defaults.js";
import type { Coupon } from "../src/discounts/types.js";
import type { Invoice } from "../src/invoice/types.js";
import type { Plan } from "../src/plans/types.js";

describe("performance scale paths", () => {
  it("caches identical resolved simulations and returns cloned invoices", async () => {
    const cache = new MemorySimulationCache(2);
    const server = buildServer({ simulationCache: cache });
    const context = createLargeContext();

    const first = await server.inject({
      method: "POST",
      url: "/v1/invoices/simulate",
      payload: context
    });
    const second = await server.inject({
      method: "POST",
      url: "/v1/invoices/simulate",
      payload: context
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json<Invoice>()).toEqual(first.json<Invoice>());
    expect(cache.stats()).toEqual({ hits: 1, misses: 1, entries: 1 });

    const key = simulationCacheKey({
      context,
      plan: fixturePlan(),
      coupons: fixtureCoupons()
    });
    const cached = cache.get(key);
    if (!cached) {
      throw new Error("expected cached invoice");
    }
    cached.totals.total = 1;
    expect(cache.get(key)?.totals.total).toBe(first.json<Invoice>().totals.total);

    await server.close();
  });

  it("keeps large-context simulation within the local performance budget", async () => {
    const cache = new MemorySimulationCache();
    const server = buildServer({ simulationCache: cache });
    const timings: number[] = [];

    for (let index = 0; index < 16; index += 1) {
      const started = performance.now();
      const response = await server.inject({
        method: "POST",
        url: "/v1/invoices/simulate",
        payload: createLargeContext(index)
      });
      timings.push(performance.now() - started);
      expect(response.statusCode).toBe(200);
    }

    timings.sort((left, right) => left - right);
    const p95 = timings[Math.ceil(timings.length * 0.95) - 1] ?? 0;
    expect(p95).toBeLessThan(250);
    expect(cache.stats().entries).toBe(16);

    await server.close();
  });

  it("evicts the oldest simulation cache entry when the bound is reached", () => {
    const cache = new MemorySimulationCache(1);
    const firstKey = simulationCacheKey({
      context: createLargeContext(1),
      plan: fixturePlan(),
      coupons: fixtureCoupons()
    });
    const secondKey = simulationCacheKey({
      context: createLargeContext(2),
      plan: fixturePlan(),
      coupons: fixtureCoupons()
    });
    const invoice = createInvoice();

    cache.set(firstKey, invoice);
    cache.set(secondKey, invoice);

    expect(cache.get(firstKey)).toBeUndefined();
    expect(cache.get(secondKey)?.totals.total).toBe(100);
    expect(cache.stats()).toEqual({ hits: 1, misses: 1, entries: 1 });
  });

  it("refreshes existing cache entries and handles a zero-sized bound", () => {
    const key = simulationCacheKey({
      context: createLargeContext(3),
      plan: fixturePlan(),
      coupons: fixtureCoupons()
    });
    const cache = new MemorySimulationCache(1);

    cache.set(key, createInvoice());
    cache.set(key, { ...createInvoice(), totals: { ...createInvoice().totals, total: 125 } });
    expect(cache.get(key)?.totals.total).toBe(125);

    const disabled = new MemorySimulationCache(-1);
    disabled.set(key, createInvoice());
    expect(disabled.stats().entries).toBe(0);
  });
});

function fixturePlan(): Plan {
  const plan = DEFAULT_PLANS.pro_monthly;
  if (!plan) {
    throw new Error("expected pro plan fixture");
  }
  return plan;
}

function fixtureCoupons(): Record<string, Coupon> {
  const save20 = DEFAULT_COUPONS.SAVE20;
  const less500 = DEFAULT_COUPONS.LESS500;
  if (!save20 || !less500) {
    throw new Error("expected coupon fixtures");
  }
  return { SAVE20: save20, LESS500: less500 };
}

function createLargeContext(seed = 0): BillingContext {
  return {
    currency: "USD",
    period: { start: "2026-01-01", end: "2026-02-01" },
    customer: { id: `cus_perf_${seed}`, taxProfile: { exempt: true, jurisdiction: "US-CA" } },
    subscription: { planId: "pro_monthly", seats: 25 + seed, changedOn: null },
    usage: Array.from({ length: 80 }, (_, index) => ({
      meter: index % 2 === 0 ? "api_calls" : "storage_gb",
      quantity: 150 + seed + index
    })),
    coupons: ["SAVE20", "LESS500"],
    credits: [
      { id: `credit_pre_${seed}`, amountMinor: 125, phase: "pre_tax" },
      { id: `credit_post_${seed}`, amountMinor: 75, phase: "post_tax" }
    ]
  };
}

function createInvoice(): Invoice {
  return {
    currency: "USD",
    lineItems: [
      {
        id: "line",
        description: "Line",
        amountMinor: 100,
        currency: "USD",
        traceId: "trace"
      }
    ],
    discounts: [],
    creditsApplied: [],
    taxLines: [],
    totals: {
      subtotal: 100,
      discountTotal: 0,
      creditTotal: 0,
      tax: 0,
      total: 100
    },
    explanation: { id: "trace", rule: "test", total: 100, inputs: {}, children: [] }
  };
}
