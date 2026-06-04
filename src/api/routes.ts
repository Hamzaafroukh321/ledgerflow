import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { allocateRefund } from "../refunds/allocate-refund.js";
import { DEFAULT_COUPONS, DEFAULT_PLANS } from "../catalog/defaults.js";
import type { Plan } from "../plans/types.js";
import { UsageEventSchema } from "./schemas.js";
import { InvoiceEngine } from "../engine/InvoiceEngine.js";
import type { Invoice } from "../invoice/types.js";
import { validateCoupon } from "../discounts/coupon.js";
import { aggregateUsage } from "../usage/aggregate.js";
import { auditInvoice } from "../audit/invoice-auditor.js";
import { assignSubscription, createCustomer, resolveBillingProfile } from "../customers/profile.js";
import { compareScenarios } from "../scenarios/compare.js";
import { createSimulationRun } from "../simulations/runs.js";
import type { TaxProfile } from "../tax/types.js";
import { BillingContextSchema } from "../engine/context.js";
import type { AsyncLedgerRepository, LedgerRepository } from "../data/repository.js";
import { scopeRepository } from "../data/scoped.js";
import type { BillingContext } from "../engine/context.js";
import type { ScenarioComparison, ScenarioInput, ScenarioResult } from "../scenarios/types.js";
import { withIdempotency, type IdempotencyStore } from "./idempotency.js";
import type { MembershipDirectory } from "./memberships.js";
import { paginate } from "./pagination.js";
import { withSpan } from "./tracing.js";

type RouteRepository = LedgerRepository | AsyncLedgerRepository;

export interface RouteDeps {
  engine: InvoiceEngine;
  repository: RouteRepository;
  memberships: MembershipDirectory;
  idempotency: IdempotencyStore;
  simulateWithEngine?: boolean;
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

const membershipSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["viewer", "editor", "admin"]),
  email: z.string().optional()
});

export function registerRoutes(server: FastifyInstance, deps: RouteDeps): void {
  server.get("/health", async () => ({ status: "ok" }));

  server.get("/plans", async (request, reply) => {
    if (serveWebRoute(request, reply, deps)) {
      return reply;
    }
    const repository = await requestRepository(request, deps);
    const plans = await repository.plans.list();
    return isVersionedApi(request) ? paginate(plans, request) : plans;
  });

  server.post("/plans", async (request, reply) => {
    const repository = await requestRepository(request, deps);
    const result = await withIdempotency(request, deps.idempotency, async () => {
      const plan = planSchema.parse(request.body) as Plan;
      await repository.plans.save(plan);
      return plan;
    });
    if (result.replayed) {
      reply.header("idempotency-replayed", "true");
    }
    return result.response;
  });

  server.post("/invoices/simulate", async (request) =>
    simulateInvoice(request.body, { ...deps, repository: await requestRepository(request, deps) })
  );

  server.get("/simulations", async (request, reply) => {
    if (serveWebRoute(request, reply, deps)) {
      return reply;
    }
    const repository = await requestRepository(request, deps);
    const simulations = await repository.simulations.list();
    return isVersionedApi(request) ? paginate(simulations, request) : simulations;
  });

  server.get("/simulations/:runId", async (request, reply) => {
    const repository = await requestRepository(request, deps);
    const params = z.object({ runId: z.string() }).parse(request.params);
    const run = await repository.simulations.get(params.runId);
    if (!run) {
      return reply.status(404).send({
        error: {
          code: "not_found",
          message: `Simulation run not found: ${params.runId}`,
          requestId: request.requestId
        }
      });
    }
    return run;
  });

  server.post("/simulations", async (request, reply) => {
    const repository = await requestRepository(request, deps);
    const result = await withIdempotency(request, deps.idempotency, async () => {
      const body = simulationRunSchema.parse(request.body);
      const context = BillingContextSchema.parse(body.context);
      const invoice = await simulateInvoice(context, { ...deps, repository });
      const runInput: Parameters<typeof createSimulationRun>[0] = { context, invoice };
      if (body.id !== undefined) {
        runInput.id = body.id;
      }
      if (body.name !== undefined) {
        runInput.name = body.name;
      }
      const run = createSimulationRun(runInput);
      await repository.simulations.save(run);
      return run;
    });
    if (result.replayed) {
      reply.header("idempotency-replayed", "true");
    }
    return result.response;
  });

  server.post("/invoices/audit", async (request) => {
    const invoice = invoiceSchema.parse(request.body);
    return auditInvoice(invoice as Invoice);
  });

  server.post("/scenarios/compare", async (request) => {
    const body = scenarioComparisonSchema.parse(request.body);
    const baseline = { name: body.baseline.name, context: body.baseline.context };
    const candidates = body.candidates.map((candidate) => ({
      name: candidate.name,
      context: candidate.context
    }));
    return deps.simulateWithEngine
      ? compareScenarios(baseline, candidates, deps.engine)
      : await compareScenariosWithRepository(baseline, candidates, {
          ...deps,
          repository: await requestRepository(request, deps)
        });
  });

  server.post("/usage/events", async (request, reply) => {
    const repository = await requestRepository(request, deps);
    const event = UsageEventSchema.parse(request.body);
    const result = await repository.usage.ingest(event);
    if (!result.accepted) {
      return reply.status(409).send(result);
    }
    return result;
  });

  server.get("/usage/events", async (request) => {
    const repository = await requestRepository(request, deps);
    const events = await repository.usage.list();
    return isVersionedApi(request) ? paginate(events, request) : events;
  });

  server.post("/usage/aggregate", async (request) => {
    const repository = await requestRepository(request, deps);
    const body = usageAggregateSchema.parse(request.body);
    const events = (await repository.usage.list()).filter(
      (event) => !body.customerId || event.customerId === body.customerId
    );
    return Object.fromEntries(aggregateUsage(events, body.period));
  });

  server.post("/coupons/validate", async (request, reply) => {
    const repository = await requestRepository(request, deps);
    const body = validateCouponSchema.parse(request.body);
    const coupon = await repository.coupons.get(body.code);
    if (!coupon) {
      return reply.status(404).send({
        error: {
          code: "not_found",
          message: `Coupon not found: ${body.code}`,
          requestId: request.requestId
        }
      });
    }
    return validateCoupon(coupon);
  });

  server.get("/customers", async (request, reply) => {
    if (serveWebRoute(request, reply, deps)) {
      return reply;
    }
    const repository = await requestRepository(request, deps);
    const customers = await repository.customers.listCustomers();
    return isVersionedApi(request) ? paginate(customers, request) : customers;
  });

  server.post("/customers", async (request) => {
    const repository = await requestRepository(request, deps);
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
    await repository.customers.saveCustomer(customer);
    return customer;
  });

  server.post("/subscriptions", async (request) => {
    const repository = await requestRepository(request, deps);
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
    await repository.customers.saveSubscription(assignment);
    return assignment;
  });

  server.get("/customers/:customerId/billing-profile", async (request, reply) => {
    const repository = await requestRepository(request, deps);
    const params = z.object({ customerId: z.string() }).parse(request.params);
    const query = billingProfileSchema.parse(request.query);
    const customer = await repository.customers.getCustomer(params.customerId);
    if (!customer) {
      return reply.status(404).send({
        error: {
          code: "not_found",
          message: `Customer not found: ${params.customerId}`,
          requestId: request.requestId
        }
      });
    }
    return resolveBillingProfile(
      customer,
      await repository.customers.listSubscriptions(params.customerId),
      query.onDate
    );
  });

  server.post("/refunds/simulate", async (request) => {
    const body = refundSchema.parse(request.body);
    return allocateRefund(body.invoice as Invoice, body.amountMinor, body.strategy);
  });

  server.get("/memberships", async (request) => {
    const principal = request.principal ?? { tenantId: "default" };
    const memberships = deps.memberships.list(principal.tenantId);
    return isVersionedApi(request) ? paginate(memberships, request) : memberships;
  });

  server.post("/memberships", async (request) => {
    const principal = request.principal ?? { tenantId: "default" };
    const body = membershipSchema.parse(request.body);
    return deps.memberships.save({
      tenantId: principal.tenantId,
      userId: body.userId,
      role: body.role,
      ...(body.email ? { email: body.email } : {})
    });
  });
}

async function requestRepository(
  request: FastifyRequest,
  deps: RouteDeps
): Promise<RouteRepository> {
  if (deps.simulateWithEngine) {
    return deps.repository;
  }
  const principal = request.principal ?? { subject: "open-mode", tenantId: "default" };
  return await withSpan("ledgerflow.repository.scope", async () => {
    const repository = scopeRepository(deps.repository, principal.tenantId, principal.subject);
    await seedTenantCatalog(repository);
    return repository;
  });
}

async function seedTenantCatalog(repository: RouteRepository): Promise<void> {
  for (const plan of Object.values(DEFAULT_PLANS)) {
    if (!(await repository.plans.get(plan.id))) {
      await repository.plans.save(plan);
    }
  }
  for (const coupon of Object.values(DEFAULT_COUPONS)) {
    if (!(await repository.coupons.get(coupon.code))) {
      await repository.coupons.save(coupon);
    }
  }
}

async function simulateInvoice(input: unknown, deps: RouteDeps): Promise<Invoice> {
  return await withSpan("ledgerflow.invoice.simulate", async () => {
    if (deps.simulateWithEngine) {
      return deps.engine.simulate(input);
    }
    const context = BillingContextSchema.parse(input);
    const plan = await deps.repository.plans.get(context.subscription.planId);
    if (!plan) {
      throw new Error(`Plan not found: ${context.subscription.planId}`);
    }
    const coupons = Object.fromEntries(
      await Promise.all(
        context.coupons.map(async (code) => {
          const coupon = await deps.repository.coupons.get(code);
          if (!coupon) {
            throw new Error(`Coupon not found: ${code}`);
          }
          return [coupon.code, coupon] as const;
        })
      )
    );
    return new InvoiceEngine({ [plan.id]: plan }, coupons).simulate(context);
  });
}

async function compareScenariosWithRepository(
  baseline: ScenarioInput,
  candidates: ScenarioInput[],
  deps: RouteDeps
): Promise<ScenarioComparison> {
  if (candidates.length === 0) {
    throw new Error("Scenario comparison requires at least one candidate");
  }
  const baselineResult = await simulateScenarioWithRepository(baseline, deps);
  const candidateResults = await Promise.all(
    candidates.map((candidate) => simulateScenarioWithRepository(candidate, deps))
  );
  return {
    baseline: baselineResult,
    candidates: candidateResults,
    deltas: candidateResults.map((candidate) => ({
      from: baselineResult.name,
      to: candidate.name,
      subtotalDelta: candidate.invoice.totals.subtotal - baselineResult.invoice.totals.subtotal,
      discountDelta:
        candidate.invoice.totals.discountTotal - baselineResult.invoice.totals.discountTotal,
      creditDelta: candidate.invoice.totals.creditTotal - baselineResult.invoice.totals.creditTotal,
      taxDelta: candidate.invoice.totals.tax - baselineResult.invoice.totals.tax,
      totalDelta: candidate.invoice.totals.total - baselineResult.invoice.totals.total
    }))
  };
}

async function simulateScenarioWithRepository(
  input: ScenarioInput,
  deps: RouteDeps
): Promise<ScenarioResult> {
  if (!input.name.trim()) {
    throw new Error("Scenario name is required");
  }
  const context: BillingContext = BillingContextSchema.parse(input.context);
  const invoice = await simulateInvoice(context, deps);
  return {
    name: input.name,
    invoice,
    audit: auditInvoice(invoice)
  };
}

function serveWebRoute(request: FastifyRequest, reply: FastifyReply, deps: RouteDeps): boolean {
  if (!deps.serveWeb || request.headers.accept?.includes("text/html") !== true) {
    return false;
  }
  reply.callNotFound();
  return true;
}

function isVersionedApi(request: FastifyRequest): boolean {
  return request.url.startsWith("/v1/");
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
