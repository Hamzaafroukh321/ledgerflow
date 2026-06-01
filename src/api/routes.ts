import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { allocateRefund } from "../refunds/allocate-refund.js";
import type { CouponRepository, PlanRepository, UsageRepository } from "../storage/repository.js";
import { UsageEventSchema } from "./schemas.js";
import type { InvoiceEngine } from "../engine/InvoiceEngine.js";
import type { Invoice } from "../invoice/types.js";
import { validateCoupon } from "../discounts/coupon.js";
import { aggregateUsage } from "../usage/aggregate.js";

export interface RouteDeps {
  engine: InvoiceEngine;
  plans: PlanRepository;
  usage: UsageRepository;
  coupons: CouponRepository;
}

const invoiceSchema = z.object({
  id: z.string().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  lineItems: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      amountMinor: z.number().int(),
      currency: z.string().regex(/^[A-Z]{3}$/),
      traceId: z.string()
    })
  ),
  discounts: z.array(z.object({ code: z.string(), amountMinor: z.number().int() })),
  creditsApplied: z.array(
    z.object({
      id: z.string(),
      amountMinor: z.number().int(),
      phase: z.enum(["pre_tax", "post_tax"])
    })
  ),
  taxLines: z.array(
    z.object({
      jurisdiction: z.string(),
      rate: z.number(),
      amountMinor: z.number().int(),
      inclusive: z.boolean()
    })
  ),
  totals: z.object({
    subtotal: z.number().int(),
    discountTotal: z.number().int(),
    creditTotal: z.number().int(),
    tax: z.number().int(),
    total: z.number().int()
  }),
  explanation: z.unknown()
});

const refundSchema = z.object({
  invoice: invoiceSchema,
  amountMinor: z.number().int().positive(),
  strategy: z.enum(["proportional", "sequential"])
});

const validateCouponSchema = z.object({
  code: z.string(),
  context: z.record(z.unknown()).optional()
});

const usageAggregateSchema = z.object({
  customerId: z.string().optional(),
  period: z.object({
    start: z.string(),
    end: z.string()
  })
});

export function registerRoutes(server: FastifyInstance, deps: RouteDeps): void {
  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      void reply.status(400).send({
        error: { code: "validation_error", message: "Request validation failed", details: error.issues }
      });
      return;
    }
    if (error instanceof Error && /not found/i.test(error.message)) {
      void reply.status(404).send({
        error: { code: "not_found", message: error.message }
      });
      return;
    }
    if (error instanceof Error && /invalid|requires|must|cannot/i.test(error.message)) {
      void reply.status(400).send({
        error: { code: "domain_error", message: error.message }
      });
      return;
    }
    void reply.status(500).send({
      error: { code: "internal_error", message: error.message }
    });
  });

  server.get("/health", async () => ({ status: "ok" }));

  server.get("/plans", async () => deps.plans.list());

  server.post("/invoices/simulate", async (request) => deps.engine.simulate(request.body));

  server.post("/usage/events", async (request, reply) => {
    const event = UsageEventSchema.parse(request.body);
    const result = deps.usage.ingest(event);
    if (!result.accepted) {
      return reply.status(409).send(result);
    }
    return result;
  });

  server.get("/usage/events", async () => deps.usage.list());

  server.post("/usage/aggregate", async (request) => {
    const body = usageAggregateSchema.parse(request.body);
    const events = deps
      .usage
      .list()
      .filter((event) => !body.customerId || event.customerId === body.customerId);
    return Object.fromEntries(aggregateUsage(events, body.period));
  });

  server.post("/coupons/validate", async (request, reply) => {
    const body = validateCouponSchema.parse(request.body);
    const coupon = deps.coupons.get(body.code);
    if (!coupon) {
      return reply.status(404).send({
        error: { code: "not_found", message: `Coupon not found: ${body.code}` }
      });
    }
    return validateCoupon(coupon);
  });

  server.post("/refunds/simulate", async (request) => {
    const body = refundSchema.parse(request.body);
    return allocateRefund(body.invoice as Invoice, body.amountMinor, body.strategy);
  });
}
