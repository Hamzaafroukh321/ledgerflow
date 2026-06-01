import type { UsageEvent, UsagePeriod } from "./types.js";

export function aggregateUsage(events: UsageEvent[], period: UsagePeriod): Map<string, number> {
  const start = parseDate(period.start);
  const end = parseDate(period.end);

  if (end <= start) {
    throw new Error("Usage period end must be after start");
  }

  const totals = new Map<string, number>();
  for (const event of events) {
    const timestamp = parseDate(event.timestamp);
    if (timestamp < start || timestamp >= end) {
      continue;
    }

    totals.set(event.meter, (totals.get(event.meter) ?? 0) + event.quantity);
  }

  return totals;
}

function parseDate(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }
  return parsed;
}
