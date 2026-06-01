import type { UsageEvent, UsageIngestResult } from "./types.js";

export interface UsageStore {
  ingest(event: UsageEvent): UsageIngestResult;
  list(): UsageEvent[];
}

export class InMemoryUsageStore implements UsageStore {
  private readonly events = new Map<string, UsageEvent>();

  public ingest(event: UsageEvent): UsageIngestResult {
    validateUsageEvent(event);
    const existing = this.events.get(event.idempotencyKey);
    if (existing) {
      return sameUsageEvent(existing, event)
        ? { accepted: false, reason: "duplicate_idempotency_key" }
        : { accepted: false, reason: "idempotency_conflict", existingEvent: { ...existing } };
    }

    this.events.set(event.idempotencyKey, { ...event });
    return { accepted: true };
  }

  public list(): UsageEvent[] {
    return [...this.events.values()].map((event) => ({ ...event }));
  }
}

export function sameUsageEvent(left: UsageEvent, right: UsageEvent): boolean {
  return (
    left.idempotencyKey === right.idempotencyKey &&
    left.customerId === right.customerId &&
    left.meter === right.meter &&
    left.quantity === right.quantity &&
    left.timestamp === right.timestamp
  );
}

export function validateUsageEvent(event: UsageEvent): void {
  if (!event.idempotencyKey || !event.customerId || !event.meter || !event.timestamp) {
    throw new Error("Usage event requires idempotencyKey, customerId, meter, and timestamp");
  }
  if (!Number.isFinite(event.quantity) || event.quantity < 0) {
    throw new Error("Usage event quantity must be non-negative");
  }
}
