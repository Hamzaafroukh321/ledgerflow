import { describe, expect, it } from "vitest";

import { aggregateUsage, InMemoryUsageStore, type UsageEvent } from "../src/index.js";

describe("usage", () => {
  const event: UsageEvent = {
    idempotencyKey: "evt_1",
    customerId: "cus_1",
    meter: "api_calls",
    quantity: 10,
    timestamp: "2025-01-15T00:00:00Z"
  };

  it("dedupes a repeated idempotency key", () => {
    const store = new InMemoryUsageStore();

    expect(store.ingest(event)).toEqual({ accepted: true });
    expect(store.ingest({ ...event, quantity: 20 })).toEqual({
      accepted: false,
      reason: "duplicate_idempotency_key"
    });
    expect(store.list()).toHaveLength(1);
  });

  it("aggregates usage within the period only", () => {
    const totals = aggregateUsage(
      [
        event,
        { ...event, idempotencyKey: "evt_2", quantity: 7, timestamp: "2025-01-31T23:00:00Z" },
        { ...event, idempotencyKey: "evt_3", quantity: 99, timestamp: "2025-02-01T00:00:00Z" }
      ],
      { start: "2025-01-01", end: "2025-02-01" }
    );

    expect(totals.get("api_calls")).toBe(17);
  });
});
