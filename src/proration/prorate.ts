import { Money } from "../money/Money.js";

export interface DateInterval {
  start: string;
  end: string;
}

export interface ProrationTrace {
  id: string;
  rule: string;
  total: number;
  inputs: Record<string, unknown>;
  children: ProrationTrace[];
}

export function prorate(
  amount: Money,
  period: DateInterval,
  effective: DateInterval,
  mode: "day" = "day"
): { amount: Money; trace: ProrationTrace } {
  if (mode !== "day") {
    throw new Error("Only day-based proration is supported");
  }

  const periodStart = dayNumber(period.start);
  const periodEnd = dayNumber(period.end);
  const rawEffectiveStart = dayNumber(effective.start);
  const rawEffectiveEnd = dayNumber(effective.end);
  const effectiveStart = Math.max(rawEffectiveStart, periodStart);
  const effectiveEnd = Math.min(rawEffectiveEnd, periodEnd);

  if (periodEnd <= periodStart) {
    throw new Error("Proration period end must be after start");
  }
  if (rawEffectiveEnd <= rawEffectiveStart) {
    throw new Error("Proration effective interval end must be after start");
  }

  const totalDays = periodEnd - periodStart;
  const activeDays = Math.max(0, effectiveEnd - effectiveStart);
  const proratedMinor = Math.round((amount.amountMinor * activeDays) / totalDays);

  return {
    amount: new Money(proratedMinor, amount.currency),
    trace: {
      id: "proration",
      rule: "day_based_proration",
      total: proratedMinor,
      inputs: {
        amountMinor: amount.amountMinor,
        totalDays,
        activeDays,
        period,
        effective
      },
      children: []
    }
  };
}

function dayNumber(value: string): number {
  const parsed = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return Math.floor(parsed / 86_400_000);
}
