import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { allocateRefund } from "../refunds/allocate-refund.js";
import type { CouponRepository, PlanRepository, UsageRepository } from "../storage/repository.js";
import { UsageEventSchema } from "./schemas.js";
import type { InvoiceEngine } from "../engine/InvoiceEngine.js";
import type { Invoice } from "../invoice/types.js";
import { validateCoupon } from "../discounts/coupon.js";

export interface RouteDeps {
  engine: InvoiceEngine;
  plans: PlanRepository;
  usage: UsageRepository;
  coupons: CouponRepository;
}

const refundSchema = z.object({
  invoice: z.custom<Invoice>(),
  amountMinor: z.number().int().positive(),
  strategy: z.enum(["proportional", "sequential"])
});

const validateCouponSchema = z.object({
  code: z.string(),
  context: z.record(z.unknown()).optional()
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
    return allocateRefund(body.invoice, body.amountMinor, body.strategy);
  });
}
