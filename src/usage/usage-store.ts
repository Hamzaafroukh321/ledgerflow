import type { UsageEvent, UsageIngestResult } from "./types.js";

export interface UsageStore {
  ingest(event: UsageEvent): UsageIngestResult;
  list(): UsageEvent[];
}

export class InMemoryUsageStore implements UsageStore {
  private readonly events = new Map<string, UsageEvent>();

  public ingest(event: UsageEvent): UsageIngestResult {
    validateUsageEvent(event);
    if (this.events.has(event.idempotencyKey)) {
      return { accepted: false, reason: "duplicate_idempotency_key" };
    }

    this.events.set(event.idempotencyKey, { ...event });
    return { accepted: true };
  }

  public list(): UsageEvent[] {
    return [...this.events.values()].map((event) => ({ ...event }));
  }
}

export function validateUsageEvent(event: UsageEvent): void {
  if (!event.idempotencyKey || !event.customerId || !event.meter || !event.timestamp) {
    throw new Error("Usage event requires idempotencyKey, customerId, meter, and timestamp");
  }
  if (!Number.isFinite(event.quantity) || event.quantity < 0) {
    throw new Error("Usage event quantity must be non-negative");
  }
}
