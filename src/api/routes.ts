import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { allocateRefund } from "../refunds/allocate-refund.js";
import type { CouponRepository, PlanRepository, UsageRepository } from "../storage/repository.js";
import { UsageEventSchema } from "./schemas.js";
import type { InvoiceEngine } from "../engine/InvoiceEngine.js";
import type { Invoice } from "../invoice/types.js";
import { validateCoupon } from "../discounts/coupon.js";
import { aggregateUsage } from "../usage/aggregate.js";
import { auditInvoice } from "../audit/invoice-auditor.js";
import { assignSubscription, createCustomer, resolveBillingProfile } from "../customers/profile.js";
import type { CustomerRepository } from "../customers/repository.js";
import { compareScenarios } from "../scenarios/compare.js";
import type { TaxProfile } from "../tax/types.js";

export interface RouteDeps {
  engine: InvoiceEngine;
  plans: PlanRepository;
  usage: UsageRepository;
  coupons: CouponRepository;
  customers: CustomerRepository;
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

const scenarioInputSchema = z.object({
  name: z.string().min(1),
  context: z.unknown()
});

const scenarioComparisonSchema = z.object({
  baseline: scenarioInputSchema,
  candidates: z.array(scenarioInputSchema).min(1)
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

const customerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().optional(),
  taxProfile: z.object({
    exempt: z.boolean(),
    jurisdiction: z.string(),
    reverseCharge: z.boolean().optional(),
    inclusive: z.boolean().optional(),
    rates: z.record(z.number()).optional()
  }),
  metadata: z.record(z.string()).optional()
});

const subscriptionSchema = z.object({
  customerId: z.string().min(1),
  planId: z.string().min(1),
  seats: z.number().int().nonnegative(),
  startsOn: z.string(),
  endsOn: z.string().optional()
});

const billingProfileSchema = z.object({
  onDate: z.string()
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

  server.post("/invoices/audit", async (request) => {
    const invoice = invoiceSchema.parse(request.body);
    return auditInvoice(invoice as Invoice);
  });

  server.post("/scenarios/compare", async (request) => {
    const body = scenarioComparisonSchema.parse(request.body);
    return compareScenarios(
      { name: body.baseline.name, context: body.baseline.context },
      body.candidates.map((candidate) => ({ name: candidate.name, context: candidate.context })),
      deps.engine
    );
  });

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

  server.get("/customers", async () => deps.customers.listCustomers());

  server.post("/customers", async (request) => {
    const body = customerSchema.parse(request.body);
    const customerInput: Parameters<typeof createCustomer>[0] = {
      id: body.id,
      name: body.name,
      taxProfile: cleanTaxProfile(body.taxProfile)
    };
    if (body.email !== undefined) {
      customerInput.email = body.email;
    }
    if (body.metadata !== undefined) {
      customerInput.metadata = body.metadata;
    }
    const customer = createCustomer(customerInput);
    deps.customers.saveCustomer(customer);
    return customer;
  });

  server.post("/subscriptions", async (request) => {
    const body = subscriptionSchema.parse(request.body);
    const assignmentInput: Parameters<typeof assignSubscription>[0] = {
      customerId: body.customerId,
      planId: body.planId,
      seats: body.seats,
      startsOn: body.startsOn
    };
    if (body.endsOn !== undefined) {
      assignmentInput.endsOn = body.endsOn;
    }
    const assignment = assignSubscription(assignmentInput);
    deps.customers.saveSubscription(assignment);
    return assignment;
  });

  server.get("/customers/:customerId/billing-profile", async (request, reply) => {
    const params = z.object({ customerId: z.string() }).parse(request.params);
    const query = billingProfileSchema.parse(request.query);
    const customer = deps.customers.getCustomer(params.customerId);
    if (!customer) {
      return reply.status(404).send({
        error: { code: "not_found", message: `Customer not found: ${params.customerId}` }
      });
    }
    return resolveBillingProfile(customer, deps.customers.listSubscriptions(params.customerId), query.onDate);
  });

  server.post("/refunds/simulate", async (request) => {
    const body = refundSchema.parse(request.body);
    return allocateRefund(body.invoice as Invoice, body.amountMinor, body.strategy);
  });
}

function cleanTaxProfile(input: {
  exempt: boolean;
  jurisdiction: string;
  reverseCharge?: boolean | undefined;
  inclusive?: boolean | undefined;
  rates?: Record<string, number> | undefined;
}): TaxProfile {
  const profile: TaxProfile = {
    exempt: input.exempt,
    jurisdiction: input.jurisdiction
  };
  if (input.reverseCharge !== undefined) {
    profile.reverseCharge = input.reverseCharge;
  }
  if (input.inclusive !== undefined) {
    profile.inclusive = input.inclusive;
  }
  if (input.rates !== undefined) {
    profile.rates = input.rates;
  }
  return profile;
}
