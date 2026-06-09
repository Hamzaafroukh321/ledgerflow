import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { auditInvoice } from "../src/audit/invoice-auditor.js";
import { registerRequestIds } from "../src/api/request-id.js";
import { withSpan } from "../src/api/tracing.js";
import { createCustomer, assignSubscription, resolveBillingProfile } from "../src/customers/profile.js";
import { MemoryCustomerRepository } from "../src/customers/repository.js";
import { validateCoupon } from "../src/discounts/coupon.js";
import { applyDiscounts } from "../src/discounts/stacking.js";
import { AppError } from "../src/errors/index.js";
import { registerErrorHandler } from "../src/errors/handler.js";
import type { Invoice } from "../src/invoice/types.js";
import { allocate, allocateEvenly } from "../src/money/allocate.js";
import { Money } from "../src/money/Money.js";
import { RoundingMode, roundMinor } from "../src/money/rounding.js";
import { prorate } from "../src/proration/prorate.js";
import { allocateRefund } from "../src/refunds/allocate-refund.js";
import { compareScenarios } from "../src/scenarios/compare.js";

describe("edge-case branch coverage", () => {
  it("audits every invoice integrity failure family", () => {
    const report = auditInvoice(
      invoice({
        lineItems: [
          {
            id: "line_bad",
            description: "Bad line",
            amountMinor: Number.MAX_SAFE_INTEGER + 1,
            currency: "EUR",
            traceId: "trace_bad"
          }
        ],
        discounts: [{ code: "BAD", amountMinor: 10 }],
        creditsApplied: [{ id: "credit_bad", amountMinor: 5, phase: "pre_tax" }],
        taxLines: [
          { jurisdiction: "US-CA", rate: -0.1, amountMinor: -1, inclusive: false },
          { jurisdiction: "US-NY", rate: 0.08, amountMinor: 50, inclusive: true }
        ],
        totals: {
          subtotal: 999,
          discountTotal: 999,
          creditTotal: 999,
          tax: 999,
          total: 999
        },
        explanation: {
          id: "root",
          rule: "bad",
          total: 998,
          inputs: {},
          children: [
            { id: "child_a", rule: "part", total: 5, inputs: {}, children: [] },
            { id: "child_b", rule: "part", total: 7, inputs: {}, children: [] }
          ]
        }
      })
    );

    expect(report.summary.valid).toBe(false);
    expect(report.issues.map((issue) => issue.code).sort()).toEqual([
      "credit_positive_amount",
      "credit_total_mismatch",
      "discount_positive_amount",
      "discount_total_mismatch",
      "invoice_total_mismatch",
      "line_amount_not_safe_integer",
      "line_currency_mismatch",
      "negative_tax_amount",
      "negative_tax_rate",
      "subtotal_mismatch",
      "tax_total_mismatch",
      "trace_reconciliation_failed",
      "trace_root_total_mismatch"
    ]);
  });

  it("covers proration boundary and validation branches", () => {
    const amount = new Money(3100, "USD");
    const period = { start: "2026-01-01", end: "2026-02-01" };

    expect(
      prorate(amount, period, { start: "2026-02-10", end: "2026-02-20" }).amount.amountMinor
    ).toBe(0);
    expect(() => prorate(amount, period, period, "hour" as "day")).toThrow(
      "Only day-based proration"
    );
    expect(() =>
      prorate(amount, { start: "2026-02-01", end: "2026-01-01" }, period)
    ).toThrow("period end");
    expect(() =>
      prorate(amount, period, { start: "2026-02-01", end: "2026-01-01" })
    ).toThrow("effective interval");
    expect(() => prorate(amount, period, { start: "not-a-date", end: "2026-01-02" })).toThrow(
      "Invalid ISO date"
    );
  });

  it("covers rounding, money, and refund allocation edge branches", () => {
    expect(roundMinor(-1.2, RoundingMode.DOWN)).toBe(-1);
    expect(roundMinor(-1.2, RoundingMode.UP)).toBe(-2);
    expect(roundMinor(2.4, RoundingMode.HALF_EVEN)).toBe(2);
    expect(roundMinor(2.6, RoundingMode.HALF_EVEN)).toBe(3);
    expect(roundMinor(2.5, RoundingMode.HALF_EVEN)).toBe(2);
    expect(roundMinor(3.5, RoundingMode.HALF_EVEN)).toBe(4);
    expect(() => roundMinor(Number.NaN)).toThrow("non-finite");
    expect(Money.fromMajor(1.25, "USD").amountMinor).toBe(125);
    expect(Money.zero("USD").isZero()).toBe(true);
    expect(new Money(5, "USD").subtract(new Money(2, "USD")).amountMinor).toBe(3);
    expect(new Money(5, "USD").negate().amountMinor).toBe(-5);
    expect(new Money(5, "USD").compare(new Money(9, "USD"))).toBe(-1);
    expect(new Money(5, "USD").toJSON()).toEqual({ amountMinor: 5, currency: "USD" });
    expect(() => new Money(1, "usd")).toThrow("Currency");
    expect(() => new Money(1, "USD").add(new Money(1, "EUR"))).toThrow("Currency mismatch");
    expect(() => new Money(1, "USD").multiply(Number.POSITIVE_INFINITY)).toThrow("finite");
    expect(allocate(new Money(0, "USD"), [])).toEqual([]);
    expect(() => allocate(new Money(100, "USD"), [1, -1])).toThrow("finite non-negative");
    expect(allocate(new Money(5, "USD"), [0, 0]).map((money) => money.amountMinor)).toEqual([3, 2]);
    expect(allocate(new Money(-5, "USD"), [1, 1]).map((money) => money.amountMinor)).toEqual([
      -3,
      -2
    ]);
    expect(() => allocateEvenly(new Money(5, "USD"), 1.5)).toThrow("non-negative integer");

    const sourceInvoice = invoice({
      id: "inv_refund",
      lineItems: [
        {
          id: "zero",
          description: "Zero",
          amountMinor: 0,
          currency: "USD",
          traceId: "trace_zero"
        },
        {
          id: "paid",
          description: "Paid",
          amountMinor: 300,
          currency: "USD",
          traceId: "trace_paid"
        }
      ],
      totals: { subtotal: 300, discountTotal: 0, creditTotal: 0, tax: 0, total: 300 },
      explanation: { id: "root", rule: "total", total: 300, inputs: {}, children: [] }
    });
    expect(allocateRefund(sourceInvoice, 1000, "sequential").creditNote).toMatchObject({
      invoiceId: "inv_refund",
      amountMinor: 300
    });
    expect(allocateRefund(sourceInvoice, 120, "proportional").allocations).toEqual([
      { lineItemId: "paid", amountMinor: 120 }
    ]);
    expect(() => allocateRefund(sourceInvoice, 0, "sequential")).toThrow("positive integer");
    expect(() => allocateRefund(sourceInvoice, 1, "specific-line" as "sequential")).toThrow(
      "Unsupported refund strategy"
    );
  });

  it("maps remaining HTTP error branches to standard envelopes", async () => {
    const server = Fastify({ logger: false });
    registerRequestIds(server);
    registerErrorHandler(server);
    server.get("/app", async () => {
      throw new AppError("edge_app", "app branch", 418, { field: "value" });
    });
    server.get("/http", async () => {
      const error = new Error("http branch") as Error & { statusCode: number };
      error.statusCode = 429;
      throw error;
    });
    server.get("/plain", async () => {
      throw "plain branch";
    });

    expect((await server.inject({ method: "GET", url: "/app" })).json()).toMatchObject({
      error: { code: "edge_app", details: { field: "value" } }
    });
    expect((await server.inject({ method: "GET", url: "/http" })).json()).toMatchObject({
      error: { code: "request_error", message: "http branch" }
    });
    expect((await server.inject({ method: "GET", url: "/plain" })).statusCode).toBe(500);

    await server.close();
  }, 15_000);

  it("covers customer profile and repository decision branches", () => {
    expect(() =>
      createCustomer({ id: " ", name: "Name", taxProfile: { exempt: true, jurisdiction: "US-CA" } })
    ).toThrow("Customer id");
    expect(() =>
      createCustomer({ id: "cus", name: " ", taxProfile: { exempt: true, jurisdiction: "US-CA" } })
    ).toThrow("Customer name");
    expect(() =>
      createCustomer({
        id: "cus",
        name: "Customer",
        email: "invalid",
        taxProfile: { exempt: true, jurisdiction: "US-CA" }
      })
    ).toThrow("email");
    expect(() =>
      assignSubscription({
        customerId: "cus",
        planId: "plan",
        seats: 1,
        startsOn: "2026-02-01",
        endsOn: "2026-01-01"
      })
    ).toThrow("after start");
    expect(() =>
      assignSubscription({
        customerId: "cus",
        planId: "plan",
        seats: 1.5,
        startsOn: "2026-01-01"
      })
    ).toThrow("non-negative integer");

    const customer = createCustomer({
      id: "cus",
      name: "Customer",
      email: "customer@example.com",
      taxProfile: { exempt: true, jurisdiction: "US-CA" }
    });
    expect(() => resolveBillingProfile(customer, [], "not-a-date")).toThrow("Invalid profile date");
    expect(resolveBillingProfile(customer, [], "2026-01-01")).toEqual({ customer });

    const repository = new MemoryCustomerRepository();
    repository.saveCustomer(customer);
    const first = assignSubscription({
      customerId: "cus",
      planId: "plan",
      seats: 1,
      startsOn: "2026-01-01"
    });
    repository.saveSubscription(first);
    repository.saveSubscription({ ...first, seats: 3 });
    expect(repository.getCustomer("missing")).toBeUndefined();
    expect(repository.listSubscriptions()).toEqual([{ ...first, seats: 3 }]);
    expect(repository.listSubscriptions("other")).toEqual([]);
  });

  it("covers discount stacking and scenario validation branches", () => {
    const lineItems = [
      { id: "base", description: "Base", amountMinor: 1000, currency: "USD" },
      { id: "addon", description: "Addon", amountMinor: 0, currency: "USD" }
    ];

    expect(() =>
      applyDiscounts(
        [
          { id: "usd", description: "USD", amountMinor: 100, currency: "USD" },
          { id: "eur", description: "EUR", amountMinor: 100, currency: "EUR" }
        ],
        []
      )
    ).toThrow("multiple currencies");
    expect(() =>
      applyDiscounts(lineItems, [
        { code: "A", kind: "fixed", value: 100, stackable: false },
        { code: "B", kind: "fixed", value: 100, stackable: false }
      ])
    ).toThrow("non-stackable");
    expect(() =>
      applyDiscounts(lineItems, [
        {
          code: "USED",
          kind: "fixed",
          value: 100,
          stackable: true,
          redemptionLimit: 1,
          redeemedCount: 1
        }
      ])
    ).toThrow("Invalid coupon USED");

    const result = applyDiscounts(lineItems, [
      { code: "BASE", kind: "percent", value: 50, stackable: true, appliesTo: ["base"] },
      { code: "CAP", kind: "fixed", value: 2000, stackable: true }
    ]);
    expect(result.discounts).toEqual([
      { code: "BASE", amountMinor: -500 },
      { code: "CAP", amountMinor: -500 }
    ]);

    expect(() => compareScenarios({ name: "base", context: createContext() }, [])).toThrow(
      "at least one candidate"
    );
    expect(() =>
      compareScenarios(
        { name: " ", context: createContext() },
        [{ name: "candidate", context: createContext(2) }]
      )
    ).toThrow("Scenario name");
    expect(validateCoupon({ code: " ", kind: "fixed", value: 1, stackable: true })).toEqual({
      valid: false,
      reason: "missing_code"
    });
    expect(validateCoupon({ code: "P", kind: "percent", value: 101, stackable: true })).toEqual({
      valid: false,
      reason: "invalid_percent_value"
    });
    expect(validateCoupon({ code: "F", kind: "fixed", value: 1.5, stackable: true })).toEqual({
      valid: false,
      reason: "invalid_fixed_value"
    });
    expect(
      validateCoupon(
        { code: "R", kind: "fixed", value: 100, stackable: true, redemptionLimit: 2 },
        { redeemedCount: 2 }
      )
    ).toEqual({ valid: false, reason: "redemption_limit_reached" });
  });

  it("propagates traced operation failures", async () => {
    await expect(
      withSpan("ledgerflow.edge.failure", async () => {
        throw new Error("traced failure");
      })
    ).rejects.toThrow("traced failure");
  });
});

function invoice(overrides: Partial<Invoice> = {}): Invoice {
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
    explanation: { id: "root", rule: "total", total: 100, inputs: {}, children: [] },
    ...overrides
  };
}

function createContext(seats = 1) {
  return {
    currency: "USD",
    period: { start: "2026-01-01", end: "2026-02-01" },
    customer: { id: "cus_edge", taxProfile: { exempt: true, jurisdiction: "US-CA" } },
    subscription: { planId: "starter_monthly", seats, changedOn: null },
    usage: [],
    coupons: [],
    credits: []
  };
}
