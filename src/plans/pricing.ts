import { Money } from "../money/Money.js";
import type { PriceComponent, PricingTrace, Tier } from "./types.js";

export interface PriceResult {
  amount: Money;
  trace: PricingTrace;
}

export function priceComponent(component: PriceComponent, quantity: number): PriceResult {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Pricing quantity must be a non-negative number");
  }

  switch (component.type) {
    case "flat":
      return priceFlat(component);
    case "per_seat":
    case "usage":
      return priceUnit(component, quantity);
    case "tiered":
    case "graduated":
      return priceGraduated(component, quantity);
    case "volume":
      return priceVolume(component, quantity);
  }
}

function priceFlat(component: PriceComponent): PriceResult {
  const amountMinor = requireUnitAmount(component);
  return {
    amount: new Money(amountMinor, component.currency),
    trace: trace(component.id, "flat_price", amountMinor, { componentId: component.id })
  };
}

function priceUnit(component: PriceComponent, quantity: number): PriceResult {
  const billableQuantity = Math.max(0, quantity - (component.includedQuantity ?? 0));
  const amountMinor = Math.round(requireUnitAmount(component) * billableQuantity);
  return {
    amount: new Money(amountMinor, component.currency),
    trace: trace(component.id, `${component.type}_price`, amountMinor, {
      componentId: component.id,
      quantity,
      billableQuantity
    })
  };
}

function priceGraduated(component: PriceComponent, quantity: number): PriceResult {
  const tiers = requireTiers(component);
  let remaining = quantity;
  let previousLimit = 0;
  let total = 0;
  const children: PricingTrace[] = [];

  for (const tier of tiers) {
    if (remaining <= 0) {
      break;
    }

    const tierLimit = tier.upTo === "infinity" ? Number.POSITIVE_INFINITY : tier.upTo;
    const tierCapacity = tierLimit - previousLimit;
    const tierQuantity = Math.min(remaining, tierCapacity);
    const tierTotal = Math.round(tierQuantity * tier.unitAmountMinor);
    total += tierTotal;
    remaining -= tierQuantity;
    previousLimit = tierLimit;

    children.push(
      trace(`${component.id}-tier-${children.length + 1}`, "graduated_tier", tierTotal, {
        upTo: tier.upTo,
        unitAmountMinor: tier.unitAmountMinor,
        quantity: tierQuantity
      })
    );
  }

  return {
    amount: new Money(total, component.currency),
    trace: {
      ...trace(component.id, "graduated_price", total, { componentId: component.id, quantity }),
      children
    }
  };
}

function priceVolume(component: PriceComponent, quantity: number): PriceResult {
  const tier = requireTiers(component).find((candidate) => {
    return candidate.upTo === "infinity" || quantity <= candidate.upTo;
  });

  if (!tier) {
    throw new Error(`No volume tier covers quantity ${quantity}`);
  }

  const amountMinor = Math.round(quantity * tier.unitAmountMinor);
  return {
    amount: new Money(amountMinor, component.currency),
    trace: trace(component.id, "volume_price", amountMinor, {
      componentId: component.id,
      quantity,
      selectedUnitAmountMinor: tier.unitAmountMinor
    })
  };
}

function requireUnitAmount(component: PriceComponent): number {
  const unitAmountMinor = component.unitAmountMinor;
  if (typeof unitAmountMinor !== "number" || !Number.isInteger(unitAmountMinor)) {
    throw new Error(`Component ${component.id} requires an integer unit amount`);
  }
  return unitAmountMinor;
}

function requireTiers(component: PriceComponent): Tier[] {
  if (!component.tiers || component.tiers.length === 0) {
    throw new Error(`Component ${component.id} requires tiers`);
  }
  return component.tiers;
}

function trace(
  id: string,
  rule: string,
  total: number,
  inputs: Record<string, unknown>
): PricingTrace {
  return {
    id,
    rule,
    total,
    inputs,
    children: []
  };
}
