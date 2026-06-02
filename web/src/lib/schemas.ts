import { z } from "zod";

export const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  })
});

export const moneySchema = z.object({
  amountMinor: z.number().int(),
  currency: z.string().regex(/^[A-Z]{3}$/)
});

export const traceNodeSchema: z.ZodType<TraceNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    rule: z.string(),
    total: z.number().int(),
    inputs: z.record(z.unknown()).optional(),
    children: z.array(traceNodeSchema)
  })
);

export interface TraceNode {
  id: string;
  rule: string;
  total: number;
  inputs?: Record<string, unknown>;
  children: TraceNode[];
}

export const lineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  amountMinor: z.number().int(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  traceId: z.string()
});

export const invoiceSchema = z.object({
  id: z.string().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  lineItems: z.array(lineItemSchema),
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
  explanation: traceNodeSchema
});

export const billingContextSchema = z.object({
  invoiceId: z.string().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  period: z.object({ start: z.string(), end: z.string() }),
  customer: z.object({
    id: z.string(),
    taxProfile: z.object({
      exempt: z.boolean(),
      jurisdiction: z.string(),
      reverseCharge: z.boolean().optional(),
      inclusive: z.boolean().optional(),
      rates: z.record(z.number()).optional()
    })
  }),
  subscription: z.object({
    planId: z.string(),
    seats: z.number().int().nonnegative(),
    changedOn: z.string().nullable().optional()
  }),
  usage: z.array(z.object({ meter: z.string(), quantity: z.number().nonnegative() })),
  coupons: z.array(z.string()),
  credits: z.array(
    z.object({
      id: z.string(),
      amountMinor: z.number().int().nonnegative(),
      phase: z.enum(["pre_tax", "post_tax"])
    })
  )
});

export const planTypeSchema = z.enum([
  "flat",
  "per_seat",
  "tiered",
  "volume",
  "graduated",
  "usage"
]);

export const tierSchema = z.object({
  upTo: z.union([z.number().int().positive(), z.literal("infinity")]),
  unitAmountMinor: z.number().int().nonnegative()
});

export const priceComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: planTypeSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  unitAmountMinor: z.number().int().nonnegative().optional(),
  tiers: z.array(tierSchema).optional(),
  meter: z.string().optional(),
  includedQuantity: z.number().int().nonnegative().optional()
});

export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: planTypeSchema,
  currency: z.string(),
  components: z.array(priceComponentSchema)
});

export const plansSchema = z.array(planSchema);

export const auditReportSchema = z.object({
  summary: z.object({
    valid: z.boolean(),
    errorCount: z.number().int(),
    warningCount: z.number().int(),
    checkedAt: z.string()
  }),
  issues: z.array(
    z.object({
      code: z.string(),
      severity: z.enum(["error", "warning"]),
      message: z.string(),
      path: z.union([z.string(), z.array(z.string())]).optional(),
      expected: z.unknown().optional(),
      actual: z.unknown().optional()
    })
  )
});

export const scenarioComparisonSchema = z.object({
  baseline: z.object({
    name: z.string(),
    invoice: invoiceSchema,
    audit: auditReportSchema
  }),
  candidates: z.array(
    z.object({
      name: z.string(),
      invoice: invoiceSchema,
      audit: auditReportSchema
    })
  ),
  deltas: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      totalDelta: z.number().int(),
      subtotalDelta: z.number().int(),
      taxDelta: z.number().int(),
      discountDelta: z.number().int(),
      creditDelta: z.number().int()
    })
  )
});

export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  taxProfile: billingContextSchema.shape.customer.shape.taxProfile,
  metadata: z.record(z.string()).optional()
});

export const customersSchema = z.array(customerSchema);

export const subscriptionAssignmentSchema = z.object({
  customerId: z.string(),
  planId: z.string(),
  seats: z.number().int().nonnegative(),
  startsOn: z.string(),
  endsOn: z.string().optional()
});

export const customerBillingProfileSchema = z.object({
  customer: customerSchema,
  activeSubscription: subscriptionAssignmentSchema.optional()
});

export const simulationRunSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  context: billingContextSchema,
  invoice: invoiceSchema
});

export const simulationsSchema = z.array(simulationRunSchema);

export const usageEventSchema = z.object({
  idempotencyKey: z.string(),
  customerId: z.string(),
  meter: z.string(),
  quantity: z.number().int().nonnegative(),
  timestamp: z.string()
});

export const usageEventsSchema = z.array(usageEventSchema);
export const usageAggregateSchema = z.record(z.number());

export const refundResultSchema = z.object({
  allocations: z.array(
    z.object({
      lineItemId: z.string(),
      amountMinor: z.number().int()
    })
  ),
  creditNote: z.object({
    amountMinor: z.number().int(),
    currency: z.string().optional(),
    reason: z.string().optional(),
    allocations: z
      .array(z.object({ lineItemId: z.string(), amountMinor: z.number().int() }))
      .optional()
  }),
  trace: traceNodeSchema
});

export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
export type BillingContext = z.infer<typeof billingContextSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Plan = z.infer<typeof planSchema>;
export type ScenarioComparison = z.infer<typeof scenarioComparisonSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type CustomerBillingProfile = z.infer<typeof customerBillingProfileSchema>;
export type SimulationRun = z.infer<typeof simulationRunSchema>;
export type UsageEvent = z.infer<typeof usageEventSchema>;
