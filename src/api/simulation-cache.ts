import { createHash } from "node:crypto";

import type { Coupon } from "../discounts/types.js";
import type { BillingContext } from "../engine/context.js";
import type { Invoice } from "../invoice/types.js";
import type { Plan } from "../plans/types.js";

export interface SimulationCacheStats {
  hits: number;
  misses: number;
  entries: number;
}

export interface SimulationCache {
  get(key: string): Invoice | undefined;
  set(key: string, invoice: Invoice): void;
  stats(): SimulationCacheStats;
}

export class MemorySimulationCache implements SimulationCache {
  private readonly entries = new Map<string, Invoice>();
  private hits = 0;
  private misses = 0;

  public constructor(private readonly maxEntries = 500) {}

  public get(key: string): Invoice | undefined {
    const invoice = this.entries.get(key);
    if (!invoice) {
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    this.entries.delete(key);
    this.entries.set(key, invoice);
    return cloneInvoice(invoice);
  }

  public set(key: string, invoice: Invoice): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }
    this.entries.set(key, cloneInvoice(invoice));
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.entries.delete(oldest);
    }
  }

  public stats(): SimulationCacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      entries: this.entries.size
    };
  }
}

export function simulationCacheKey(input: {
  context: BillingContext;
  plan: Plan;
  coupons: Record<string, Coupon>;
}): string {
  const hash = createHash("sha256");
  hash.update(stableStringify({ version: 1, ...input }));
  return hash.digest("hex");
}

function cloneInvoice(invoice: Invoice): Invoice {
  return structuredClone(invoice) as Invoice;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .filter((key) => source[key] !== undefined)
        .map((key) => [key, stableValue(source[key])])
    );
  }
  return value;
}
