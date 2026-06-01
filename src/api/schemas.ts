import { z } from "zod";

export const UsageEventSchema = z.object({
  idempotencyKey: z.string().min(1),
  meter: z.string().min(1),
  quantity: z.number().nonnegative(),
  timestamp: z.string().min(1),
  customerId: z.string().min(1)
});
