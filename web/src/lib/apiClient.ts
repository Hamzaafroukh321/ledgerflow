import { z } from "zod";

import {
  apiErrorEnvelopeSchema,
  auditReportSchema,
  billingContextSchema,
  customerBillingProfileSchema,
  customerSchema,
  customersSchema,
  invoiceSchema,
  plansSchema,
  refundResultSchema,
  scenarioComparisonSchema,
  subscriptionAssignmentSchema,
  usageEventSchema,
  type BillingContext,
  type Invoice
} from "./schemas";

export class ApiError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? import.meta.env.VITE_LEDGERFLOW_API_BASE ?? "";
  const fetchImpl = options.fetchImpl;

  async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
    const response = await (fetchImpl ?? fetch)(toRequestUrl(baseUrl, path), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init?.headers
      }
    });
    const payload = await parseJson(response);
    if (!response.ok) {
      const parsed = apiErrorEnvelopeSchema.safeParse(payload);
      if (parsed.success) {
        throw new ApiError(
          parsed.data.error.code,
          parsed.data.error.message,
          response.status,
          parsed.data.error.details
        );
      }
      throw new ApiError("http_error", response.statusText || "Request failed", response.status);
    }
    return schema.parse(payload);
  }

  return {
    listPlans: () => request("/plans", plansSchema),
    simulateInvoice: (context: BillingContext) =>
      request("/invoices/simulate", invoiceSchema, body("POST", billingContextSchema.parse(context))),
    auditInvoice: (invoice: Invoice) =>
      request("/invoices/audit", auditReportSchema, body("POST", invoiceSchema.parse(invoice))),
    compareScenarios: (input: unknown) =>
      request("/scenarios/compare", scenarioComparisonSchema, body("POST", input)),
    listCustomers: () => request("/customers", customersSchema),
    createCustomer: (input: unknown) =>
      request("/customers", customerSchema, body("POST", customerSchema.parse(input))),
    assignSubscription: (input: unknown) =>
      request("/subscriptions", subscriptionAssignmentSchema, body("POST", subscriptionAssignmentSchema.parse(input))),
    getBillingProfile: (customerId: string, onDate: string) =>
      request(
        `/customers/${encodeURIComponent(customerId)}/billing-profile?onDate=${encodeURIComponent(onDate)}`,
        customerBillingProfileSchema
      ),
    ingestUsage: (event: unknown) =>
      request("/usage/events", z.object({ accepted: z.boolean(), reason: z.string().optional() }), body("POST", usageEventSchema.parse(event))),
    simulateRefund: (input: unknown) =>
      request("/refunds/simulate", refundResultSchema, body("POST", input))
  };
}

export const apiClient = createApiClient();

function toRequestUrl(baseUrl: string, path: string): string {
  const combined = `${baseUrl}${path}`;
  if (/^https?:\/\//.test(combined)) {
    return combined;
  }
  if (typeof window !== "undefined") {
    return new URL(combined, window.location.origin).toString();
  }
  return combined;
}

function body(method: string, value: unknown): RequestInit {
  return {
    method,
    body: JSON.stringify(value)
  };
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text.length > 0 ? (JSON.parse(text) as unknown) : undefined;
}
