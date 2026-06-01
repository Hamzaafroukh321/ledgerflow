import { useMutation } from "@tanstack/react-query";

import { apiClient } from "../lib/apiClient";
import type { BillingContext } from "../lib/schemas";

export function useSimulateInvoice() {
  return useMutation({
    mutationFn: (context: BillingContext) => apiClient.simulateInvoice(context)
  });
}
