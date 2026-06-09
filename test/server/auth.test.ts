import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { buildServer } from "../../src/api/server.js";
import { registerTokenAuth } from "../../src/api/auth.js";
import type { BillingContext } from "../../src/index.js";

const context: BillingContext = {
  currency: "USD",
  period: { start: "2025-01-01", end: "2025-02-01" },
  customer: { id: "cus_auth", taxProfile: { exempt: true, jurisdiction: "US-CA" } },
  subscription: { planId: "starter_monthly", seats: 1, changedOn: null },
  usage: [],
  coupons: [],
  credits: []
};

const protectedRoutes = [
  { method: "GET", url: "/plans" },
  { method: "POST", url: "/invoices/simulate", payload: context },
  { method: "GET", url: "/simulations" },
  { method: "POST", url: "/usage/events", payload: {} },
  { method: "POST", url: "/coupons/validate", payload: { code: "SAVE20", context: {} } },
  { method: "GET", url: "/customers" },
  { method: "POST", url: "/subscriptions", payload: {} },
  { method: "POST", url: "/refunds/simulate", payload: {} },
  { method: "POST", url: "/scenarios/compare", payload: {} },
  { method: "GET", url: "/missing" }
] as const;

describe("token auth", () => {
  it("keeps health and docs open when a token is configured", async () => {
    const server = buildServer({}, { LEDGERFLOW_API_TOKEN: "phase-token" });

    await expect(server.inject({ method: "GET", url: "/health" })).resolves.toMatchObject({
      statusCode: 200
    });
    await expect(server.inject({ method: "GET", url: "/openapi.json" })).resolves.toMatchObject({
      statusCode: 200
    });
    await expect(server.inject({ method: "GET", url: "/docs" })).resolves.toMatchObject({
      statusCode: expect.any(Number)
    });
    await server.close();
  });

  it.each(protectedRoutes)("rejects unauthenticated $method $url", async (route) => {
    const server = buildServer({}, { LEDGERFLOW_API_TOKEN: "phase-token" });

    let response;
    if ("payload" in route) {
      response = await server.inject({
        method: route.method,
        url: route.url,
        payload: route.payload
      });
    } else {
      response = await server.inject({
        method: route.method,
        url: route.url
      });
    }

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: "unauthorized",
        message: "A valid LedgerFlow API token is required.",
        requestId: expect.any(String)
      }
    });
    await server.close();
  });

  it("accepts bearer tokens and decorates a principal for later isolation phases", async () => {
    const server = buildServer({}, { LEDGERFLOW_API_TOKEN: "phase-token" });
    server.get("/whoami", async (request) => request.principal);

    const response = await server.inject({
      method: "GET",
      url: "/whoami",
      headers: { authorization: "Bearer phase-token" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      subject: "api-token",
      tenantId: "default",
      role: "admin"
    });
    await server.close();
  });

  it("allows preflight, docs assets, and static web routes while still guarding JSON API calls", async () => {
    const server = buildServer(
      {},
      { LEDGERFLOW_API_TOKEN: "phase-token", LEDGERFLOW_SERVE_WEB: "1" }
    );

    const preflight = await server.inject({ method: "OPTIONS", url: "/plans" });
    const docsAsset = await server.inject({ method: "GET", url: "/docs/static/index.css" });
    const webRoute = await server.inject({
      method: "GET",
      url: "/settings",
      headers: { accept: "application/json" }
    });
    const guardedJson = await server.inject({
      method: "GET",
      url: "/plans",
      headers: { accept: "application/json" }
    });

    expect(preflight.statusCode).not.toBe(401);
    expect(docsAsset.statusCode).not.toBe(401);
    expect(webRoute.statusCode).not.toBe(401);
    expect(guardedJson.statusCode).toBe(401);
    await server.close();
  });

  it("accepts the legacy token header and rejects malformed bearer headers", async () => {
    const server = buildServer({}, { LEDGERFLOW_API_TOKEN: "phase-token" });

    const legacy = await server.inject({
      method: "GET",
      url: "/plans",
      headers: { "x-ledgerflow-token": ["phase-token"] }
    });
    const malformed = await server.inject({
      method: "GET",
      url: "/plans",
      headers: { authorization: "Token phase-token" }
    });
    const wrongLength = await server.inject({
      method: "GET",
      url: "/plans",
      headers: { authorization: "Bearer nope" }
    });

    expect(legacy.statusCode).toBe(200);
    expect(malformed.statusCode).toBe(401);
    expect(wrongLength.statusCode).toBe(401);
    await server.close();
  });

  it("keeps open mode working and emits a startup warning", async () => {
    const warnOpenMode = vi.fn();
    const server = Fastify();
    registerTokenAuth(server, { warnOpenMode });
    server.get("/plans", async () => [{ id: "open" }]);

    const response = await server.inject({ method: "GET", url: "/plans" });

    expect(response.statusCode).toBe(200);
    expect(warnOpenMode).toHaveBeenCalledOnce();
    expect(warnOpenMode).toHaveBeenCalledWith(
      "LEDGERFLOW_API_TOKEN is unset; API authentication is in open mode."
    );
    await server.close();
  });

  it("enforces body size and rate limits with authenticated requests", async () => {
    const bodyLimited = buildServer(
      {},
      { LEDGERFLOW_API_TOKEN: "phase-token", LEDGERFLOW_BODY_LIMIT_BYTES: "64" }
    );

    const oversized = await bodyLimited.inject({
      method: "POST",
      url: "/invoices/simulate",
      headers: { authorization: "Bearer phase-token", "content-type": "application/json" },
      payload: { context, filler: "x".repeat(256) }
    });
    expect(oversized.statusCode).toBe(413);
    await bodyLimited.close();

    const rateLimited = buildServer(
      {},
      {
        LEDGERFLOW_API_TOKEN: "phase-token",
        LEDGERFLOW_RATE_LIMIT_MAX: "1",
        LEDGERFLOW_RATE_LIMIT_WINDOW: "1 minute"
      }
    );
    await rateLimited.ready();
    const first = await rateLimited.inject({
      method: "GET",
      url: "/plans",
      headers: { authorization: "Bearer phase-token" }
    });
    const second = await rateLimited.inject({
      method: "GET",
      url: "/plans",
      headers: { authorization: "Bearer phase-token" }
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    await rateLimited.close();
  });
});
