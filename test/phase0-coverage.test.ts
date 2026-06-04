import { describe, expect, it } from "vitest";

import {
  aggregateUsage,
  allocate,
  allocateEvenly,
  applyCredits,
  assignSubscription,
  ConflictError,
  createLineItem,
  createSimulationRun,
  CurrencyError,
  IdempotencyError,
  InMemoryUsageStore,
  Money,
  NotFoundError,
  priceComponent,
  PricingRuleError,
  reconcile,
  roundMinor,
  RoundingMode,
  TaxError,
  traceNode,
  ValidationError,
  type AppError,
  type BillingContext,
  type PriceComponent
} from "../src/index.js";

const context: BillingContext = {
  currency: "USD",
  period: { start: "2025-01-01", end: "2025-02-01" },
  customer: { id: "cus_1", taxProfile: { exempt: true, jurisdiction: "US-CA" } },
  subscription: { planId: "starter_monthly", seats: 1, changedOn: null },
  usage: [],
  coupons: [],
  credits: []
};

describe("Phase 0 coverage locks", () => {
  it("covers rounding modes and allocation edge cases", () => {
    expect(roundMinor(1.5, RoundingMode.HALF_UP)).toBe(2);
    expect(roundMinor(2.5, RoundingMode.HALF_EVEN)).toBe(2);
    expect(roundMinor(3.5, RoundingMode.HALF_EVEN)).toBe(4);
    expect(roundMinor(-1.2, RoundingMode.DOWN)).toBe(-1);
    expect(roundMinor(-1.2, RoundingMode.UP)).toBe(-2);
    expect(() => roundMinor(Number.NaN)).toThrow(/non-finite/);

    expect(allocate(new Money(0, "USD"), [])).toEqual([]);
    expect(allocate(new Money(5, "USD"), [0, 0]).map((amount) => amount.amountMinor)).toEqual([
      3,
      2
    ]);
    expect(allocate(new Money(-5, "USD"), [1, 1]).map((amount) => amount.amountMinor)).toEqual([
      -3,
      -2
    ]);
    expect(() => allocate(new Money(5, "USD"), [1, -1])).toThrow(/weights/);
    expect(allocateEvenly(new Money(0, "USD"), 0)).toEqual([]);
    expect(() => allocateEvenly(new Money(5, "USD"), -1)).toThrow(/count/);
  });

  it("covers credit validation and zero-balance carry-forward", () => {
    expect(() => applyCredits(-1, [], "pre_tax")).toThrow(/subtotal/);
    expect(() => applyCredits(100, [{ id: "", amountMinor: 1, phase: "pre_tax" }], "pre_tax"))
      .toThrow(/id/);
    expect(() =>
      applyCredits(100, [{ id: "cr_bad", amountMinor: 0, phase: "pre_tax" }], "pre_tax")
    ).toThrow(/positive/);
    expect(
      applyCredits(0, [{ id: "cr_later", amountMinor: 100, phase: "pre_tax" }], "pre_tax")
        .remainingCredits
    ).toEqual([{ id: "cr_later", amountMinor: 100, phase: "pre_tax" }]);
  });

  it("covers usage aggregation and validation failures", () => {
    const event = {
      idempotencyKey: "evt_1",
      customerId: "cus_1",
      meter: "api",
      quantity: 2,
      timestamp: "2025-01-15T00:00:00Z"
    };
    expect(
      aggregateUsage(
        [
          event,
          { ...event, idempotencyKey: "evt_2", timestamp: "2025-02-01T00:00:00Z" }
        ],
        { start: "2025-01-01", end: "2025-02-01" }
      )
    ).toEqual(new Map([["api", 2]]));
    expect(() => aggregateUsage([], { start: "bad", end: "2025-02-01" })).toThrow(/Invalid/);
    expect(() =>
      aggregateUsage([], { start: "2025-02-01", end: "2025-01-01" })
    ).toThrow(/after start/);

    const store = new InMemoryUsageStore();
    expect(() =>
      store.ingest({ ...event, idempotencyKey: "", quantity: Number.NaN })
    ).toThrow(/requires/);
    expect(() => store.ingest({ ...event, quantity: -1 })).toThrow(/non-negative/);
  });

  it("covers simulation run metadata validation", () => {
    const invoice = {
      currency: "USD",
      lineItems: [],
      discounts: [],
      creditsApplied: [],
      taxLines: [],
      totals: { subtotal: 0, discountTotal: 0, creditTotal: 0, tax: 0, total: 0 },
      explanation: { id: "root", rule: "invoice_total", total: 0, children: [] }
    };

    expect(createSimulationRun({ context, invoice }).name).toBe(
      "cus_1 starter_monthly 2025-01-01"
    );
    expect(() => createSimulationRun({ id: " ", context, invoice })).toThrow(/id/);
    expect(() => createSimulationRun({ name: " ", context, invoice })).toThrow(/name/);
    expect(() =>
      createSimulationRun({ createdAt: "not-a-date", context, invoice })
    ).toThrow(/timestamp/);
  });

  it("covers pricing validation and included quantity branches", () => {
    const unit: PriceComponent = {
      id: "seat",
      name: "Seat",
      type: "per_seat",
      currency: "USD",
      unitAmountMinor: 100,
      includedQuantity: 2
    };
    expect(priceComponent(unit, 5).amount.amountMinor).toBe(300);
    const flat: PriceComponent = {
      id: "flat",
      name: "Flat",
      type: "flat",
      currency: "USD",
      unitAmountMinor: 500
    };
    const missingUnit: PriceComponent = {
      id: "missing",
      name: "Missing",
      type: "per_seat",
      currency: "USD"
    };
    expect(priceComponent(flat, 999).trace.rule).toBe("flat_price");
    expect(() => priceComponent(unit, -1)).toThrow(/quantity/);
    expect(() => priceComponent(missingUnit, 1)).toThrow(/unit/);
    expect(() => priceComponent({ ...unit, type: "tiered", tiers: [] }, 1)).toThrow(/tiers/);
    expect(() =>
      priceComponent(
        { ...unit, type: "volume", tiers: [{ upTo: 1, unitAmountMinor: 10 }] },
        2
      )
    ).toThrow(/No volume tier/);
    expect(() =>
      priceComponent(
        { ...unit, type: "graduated", tiers: [{ upTo: 1, unitAmountMinor: -1 }] },
        1
      )
    ).toThrow(/unit amounts/);
  });

  it("covers invoice helper and error-class branches", () => {
    expect(createLineItem({ id: "base", description: "Base", amountMinor: 1, currency: "USD" }))
      .toMatchObject({ traceId: "trace-base" });
    expect(() =>
      createLineItem({ id: "bad", description: "Bad", amountMinor: 1.2, currency: "USD" })
    ).toThrow(/integer/);

    expect(traceNode({ id: "node", rule: "rule", total: 1, inputs: { x: 1 } }).inputs).toEqual({
      x: 1
    });
    expect(reconcile(traceNode({ id: "leaf", rule: "leaf", total: 1.2 }))).toBe(false);
    expect(
      reconcile(
        traceNode({
          id: "root",
          rule: "sum",
          total: 3,
          children: [traceNode({ id: "a", rule: "leaf", total: 1 })]
        })
      )
    ).toBe(false);

    const errors: AppError[] = [
      new ValidationError("bad input", { field: "id" }),
      new NotFoundError("missing"),
      new ConflictError("conflict"),
      new PricingRuleError("pricing"),
      new CurrencyError("currency"),
      new IdempotencyError("duplicate"),
      new TaxError("tax")
    ];
    expect(errors.map((error) => [error.name, error.status])).toEqual([
      ["ValidationError", 400],
      ["NotFoundError", 404],
      ["ConflictError", 409],
      ["PricingRuleError", 422],
      ["CurrencyError", 422],
      ["IdempotencyError", 409],
      ["TaxError", 422]
    ]);
  });

  it("covers subscription end-date optional branches", () => {
    expect(
      assignSubscription({
        customerId: "cus_1",
        planId: "starter_monthly",
        seats: 1,
        startsOn: "2025-01-01"
      }).endsOn
    ).toBeUndefined();
  });
});
