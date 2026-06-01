import { describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient } from "./apiClient";

function response(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers: { "content-type": "application/json" }
  });
}

describe("api client", () => {
  const invoice = {
    currency: "USD",
    lineItems: [],
    discounts: [],
    creditsApplied: [],
    taxLines: [],
    totals: { subtotal: 0, discountTotal: 0, creditTotal: 0, tax: 0, total: 0 },
    explanation: { id: "root", rule: "invoice_total", total: 0, children: [] }
  };

  it("builds relative requests and validates successful responses", async () => {
    const fetchImpl = vi.fn(async () =>
      response([{ id: "pro_monthly", name: "Pro", type: "per_seat", currency: "USD", components: [] }])
    );
    const client = createApiClient({ fetchImpl });

    await expect(client.listPlans()).resolves.toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringMatching(/\/plans$/), expect.objectContaining({ headers: expect.any(Object) }));
  });

  it("turns error envelopes into typed ApiError instances", async () => {
    const fetchImpl = vi.fn(async () =>
      response({ error: { code: "not_found", message: "Missing plan" } }, { status: 404 })
    );
    const client = createApiClient({ fetchImpl });

    await expect(client.listPlans()).rejects.toMatchObject({
      code: "not_found",
      message: "Missing plan",
      status: 404
    } satisfies Partial<ApiError>);
  });

  it("turns non-envelope failures into generic ApiError instances", async () => {
    const fetchImpl = vi.fn(async () => response({ message: "Nope" }, { status: 500, statusText: "Server Error" }));
    const client = createApiClient({ fetchImpl });

    await expect(client.listPlans()).rejects.toMatchObject({
      code: "http_error",
      message: "Server Error",
      status: 500
    } satisfies Partial<ApiError>);
  });

  it("sends JSON bodies for simulations", async () => {
    const fetchImpl = vi.fn(async () =>
      response(invoice)
    );
    const client = createApiClient({ baseUrl: "/api", fetchImpl });

    await client.simulateInvoice({
      currency: "USD",
      period: { start: "2026-01-01", end: "2026-02-01" },
      customer: { id: "cus_1", taxProfile: { exempt: true, jurisdiction: "US" } },
      subscription: { planId: "pro_monthly", seats: 1 },
      usage: [],
      coupons: [],
      credits: []
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/invoices\/simulate$/),
      expect.objectContaining({ method: "POST", body: expect.stringContaining("pro_monthly") })
    );
  });

  it("wraps audit, scenario, usage, and refund endpoints", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/invoices/audit")) {
        return response({
          summary: { valid: true, errorCount: 0, warningCount: 0, checkedAt: "deterministic" },
          issues: []
        });
      }
      if (url.endsWith("/scenarios/compare")) {
        return response({
          baseline: {
            name: "base",
            invoice,
            audit: { summary: { valid: true, errorCount: 0, warningCount: 0, checkedAt: "now" }, issues: [] }
          },
          candidates: [],
          deltas: []
        });
      }
      if (url.endsWith("/usage/events")) {
        return response({ accepted: true });
      }
      return response({
        allocations: [],
        creditNote: { amountMinor: 100, currency: "USD", reason: "refund" },
        trace: { id: "root", rule: "refund", total: 100, children: [] }
      });
    });
    const client = createApiClient({ fetchImpl });

    await expect(client.auditInvoice(invoice)).resolves.toMatchObject({ summary: { valid: true } });
    await expect(client.compareScenarios({ baseline: {}, candidates: [] })).resolves.toMatchObject({ deltas: [] });
    await expect(
      client.ingestUsage({
        idempotencyKey: "u1",
        customerId: "cus_1",
        meter: "api_calls",
        quantity: 1,
        timestamp: "2026-01-01T00:00:00.000Z"
      })
    ).resolves.toMatchObject({ accepted: true });
    await expect(client.simulateRefund({ invoice, amountMinor: 100, strategy: "proportional" })).resolves.toMatchObject({
      creditNote: { amountMinor: 100 }
    });
  });
});
