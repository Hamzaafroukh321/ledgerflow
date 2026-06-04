import { z } from "zod";

export const BillingContextSchema = z.object({
  invoiceId: z.string().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  period: z.object({
    start: z.string(),
    end: z.string()
  }),
  customer: z.object({
    id: z.string(),
    taxProfile: z.object({
      exempt: z.boolean(),
      jurisdiction: z.string(),
      reverseCharge: z.boolean().optional(),
      inclusive: z.boolean().optional(),
      rates: z.record(z.string(), z.number()).optional()
    })
  }),
  subscription: z.object({
    planId: z.string(),
    seats: z.number().int().nonnegative(),
    changedOn: z.string().nullable().optional()
  }),
  usage: z
    .array(
      z.object({
        meter: z.string(),
        quantity: z.number().nonnegative()
      })
    )
    .default([]),
  coupons: z.array(z.string()).default([]),
  credits: z
    .array(
      z.object({
        id: z.string(),
        amountMinor: z.number().int().positive(),
        phase: z.enum(["pre_tax", "post_tax"])
      })
    )
    .default([])
});

export type BillingContext = z.infer<typeof BillingContextSchema>;

export function parseBillingContext(input: unknown): BillingContext {
  return BillingContextSchema.parse(input);
}
