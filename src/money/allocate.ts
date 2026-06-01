import { Money } from "./Money.js";

export function allocate(total: Money, weights: number[]): Money[] {
  if (weights.length === 0) {
    return [];
  }

  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new Error("Allocation weights must be finite non-negative numbers");
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight === 0) {
    return allocateEvenly(total, weights.length);
  }

  const sign = Math.sign(total.amountMinor) || 1;
  const absoluteTotal = Math.abs(total.amountMinor);
  const rawShares = weights.map((weight, index) => {
    const exact = (absoluteTotal * weight) / totalWeight;
    const floor = Math.floor(exact);
    return {
      index,
      floor,
      remainder: exact - floor,
      weight
    };
  });

  const allocated = rawShares.map((share) => share.floor);
  let remaining = absoluteTotal - allocated.reduce((sum, amount) => sum + amount, 0);

  const remainderOrder = [...rawShares].sort((left, right) => {
    if (right.remainder !== left.remainder) {
      return right.remainder - left.remainder;
    }
    if (right.weight !== left.weight) {
      return right.weight - left.weight;
    }
    return left.index - right.index;
  });

  for (const share of remainderOrder) {
    if (remaining === 0) {
      break;
    }
    allocated[share.index] = (allocated[share.index] ?? 0) + 1;
    remaining -= 1;
  }

  return allocated.map((amount) => new Money(sign * amount, total.currency));
}

export function allocateEvenly(total: Money, n: number): Money[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("Allocation count must be a non-negative integer");
  }
  if (n === 0) {
    return [];
  }

  const sign = Math.sign(total.amountMinor) || 1;
  const absoluteTotal = Math.abs(total.amountMinor);
  const base = Math.floor(absoluteTotal / n);
  const remainder = absoluteTotal % n;

  return Array.from({ length: n }, (_, index) => {
    const amount = base + (index < remainder ? 1 : 0);
    return new Money(sign * amount, total.currency);
  });
}
