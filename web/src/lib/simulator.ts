import { z } from "zod";

import { parseMajorToMinor } from "./money";

export const simulatorFormSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a three-letter uppercase currency code"),
  customerId: z.string().min(1, "Customer ID is required"),
  jurisdiction: z.string().min(1, "Tax jurisdiction is required"),
  planId: z.string().min(1, "Plan is required"),
  seats: z.coerce.number().int().positive("Seats must be at least 1"),
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  apiCalls: z.coerce.number().int().nonnegative("Usage cannot be negative"),
  couponCode: z.string().optional(),
  creditMajor: z.string().optional()
});

export type SimulatorFormInput = z.input<typeof simulatorFormSchema>;
export type SimulatorFormValues = z.output<typeof simulatorFormSchema>;

export const defaultSimulatorValues: SimulatorFormValues = {
  currency: "USD",
  customerId: "cus_1",
  jurisdiction: "US-CA",
  planId: "pro_monthly",
  seats: 5,
  periodStart: "2026-01-01",
  periodEnd: "2026-02-01",
  apiCalls: 12000,
  couponCode: "SAVE20",
  creditMajor: "0.00"
};

export function buildBillingContext(values: SimulatorFormValues) {
  const creditMinor =
    values.creditMajor && values.creditMajor.trim().length > 0 ? parseMajorToMinor(values.creditMajor) : 0;
  const credits =
    creditMinor > 0
      ? [{ id: "manual_credit", amountMinor: creditMinor, phase: "pre_tax" as const }]
      : [];

  return {
    currency: values.currency,
    period: { start: values.periodStart, end: values.periodEnd },
    customer: {
      id: values.customerId,
      taxProfile: { exempt: false, jurisdiction: values.jurisdiction }
    },
    subscription: { planId: values.planId, seats: values.seats, changedOn: null },
    usage: [{ meter: "api_calls", quantity: values.apiCalls }],
    coupons: values.couponCode ? [values.couponCode] : [],
    credits
  };
}
