import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { allocateRefund } from "../refunds/allocate-refund.js";
import type { Plan } from "../plans/types.js";
import { UsageEventSchema } from "./schemas.js";
import type { InvoiceEngine } from "../engine/InvoiceEngine.js";
import type { Invoice } from "../invoice/types.js";
import { validateCoupon } from "../discounts/coupon.js";
import { aggregateUsage } from "../usage/aggregate.js";
import { auditInvoice } from "../audit/invoice-auditor.js";
import { assignSubscription, createCustomer, resolveBillingProfile } from "../customers/profile.js";
import { compareScenarios } from "../scenarios/compare.js";
import { createSimulationRun } from "../simulations/runs.js";
import type { TaxProfile } from "../tax/types.js";
import { BillingContextSchema } from "../engine/context.js";
import type { LedgerRepository } from "../data/repository.js";

export interface RouteDeps {
  engine: InvoiceEngine;
  repository: LedgerRepository;
  serveWeb?: boolean;
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
  context: z.record(z.string(), z.unknown()).optional()
});

const usageAggregateSchema = z.object({
  customerId: z.string().optional(),
  period: z.object({
    start: z.string(),
    end: z.string()
  })
});

const planTypeSchema = z.enum(["flat", "per_seat", "tiered", "volume", "graduated", "usage"]);

const tierSchema = z.object({
  upTo: z.union([z.number().int().positive(), z.literal("infinity")]),
  unitAmountMinor: z.number().int().nonnegative()
});

const priceComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: planTypeSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  unitAmountMinor: z.number().int().nonnegative().optional(),
  tiers: z.array(tierSchema).optional(),
  meter: z.string().optional(),
  includedQuantity: z.number().int().nonnegative().optional()
});

const planSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: planTypeSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  components: z.array(priceComponentSchema).min(1)
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
    rates: z.record(z.string(), z.number()).optional()
  }),
  metadata: z.record(z.string(), z.string()).optional()
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

const simulationRunSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  context: z.unknown()
});

export function registerRoutes(server: FastifyInstance, deps: RouteDeps): void {
  server.get("/health", async () => ({ status: "ok" }));

  server.get("/plans", async (request, reply) => {
    if (serveWebRoute(request, reply, deps)) {
      return reply;
    }
    return deps.repository.plans.list();
  });

  server.post("/plans", async (request) => {
    const plan = planSchema.parse(request.body) as Plan;
    deps.repository.plans.save(plan);
    return plan;
  });

  server.post("/invoices/simulate", async (request) => deps.engine.simulate(request.body));

  server.get("/simulations", async (request, reply) => {
    if (serveWebRoute(request, reply, deps)) {
      return reply;
    }
    return deps.repository.simulations.list();
  });

  server.get("/simulations/:runId", async (request, reply) => {
    const params = z.object({ runId: z.string() }).parse(request.params);
    const run = deps.repository.simulations.get(params.runId);
    if (!run) {
      return reply.status(404).send({
        error: { code: "not_found", message: `Simulation run not found: ${params.runId}` }
      });
    }
    return run;
  });

  server.post("/simulations", async (request) => {
    const body = simulationRunSchema.parse(request.body);
    const context = BillingContextSchema.parse(body.context);
    const invoice = deps.engine.simulate(context);
    const runInput: Parameters<typeof createSimulationRun>[0] = { context, invoice };
    if (body.id !== undefined) {
      runInput.id = body.id;
    }
    if (body.name !== undefined) {
      runInput.name = body.name;
    }
    const run = createSimulationRun(runInput);
    deps.repository.simulations.save(run);
    return run;
  });

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
    const result = deps.repository.usage.ingest(event);
    if (!result.accepted) {
      return reply.status(409).send(result);
    }
    return result;
  });

  server.get("/usage/events", async () => deps.repository.usage.list());

  server.post("/usage/aggregate", async (request) => {
    const body = usageAggregateSchema.parse(request.body);
    const events = deps.repository.usage
      .list()
      .filter((event) => !body.customerId || event.customerId === body.customerId);
    return Object.fromEntries(aggregateUsage(events, body.period));
  });

  server.post("/coupons/validate", async (request, reply) => {
    const body = validateCouponSchema.parse(request.body);
    const coupon = deps.repository.coupons.get(body.code);
    if (!coupon) {
      return reply.status(404).send({
        error: { code: "not_found", message: `Coupon not found: ${body.code}` }
      });
    }
    return validateCoupon(coupon);
  });

  server.get("/customers", async (request, reply) => {
    if (serveWebRoute(request, reply, deps)) {
      return reply;
    }
    return deps.repository.customers.listCustomers();
  });

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
    deps.repository.customers.saveCustomer(customer);
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
    deps.repository.customers.saveSubscription(assignment);
    return assignment;
  });

  server.get("/customers/:customerId/billing-profile", async (request, reply) => {
    const params = z.object({ customerId: z.string() }).parse(request.params);
    const query = billingProfileSchema.parse(request.query);
    const customer = deps.repository.customers.getCustomer(params.customerId);
    if (!customer) {
      return reply.status(404).send({
        error: { code: "not_found", message: `Customer not found: ${params.customerId}` }
      });
    }
    return resolveBillingProfile(
      customer,
      deps.repository.customers.listSubscriptions(params.customerId),
      query.onDate
    );
  });

  server.post("/refunds/simulate", async (request) => {
    const body = refundSchema.parse(request.body);
    return allocateRefund(body.invoice as Invoice, body.amountMinor, body.strategy);
  });
}

function serveWebRoute(request: FastifyRequest, reply: FastifyReply, deps: RouteDeps): boolean {
  if (!deps.serveWeb || request.headers.accept?.includes("text/html") !== true) {
    return false;
  }
  reply.callNotFound();
  return true;
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
