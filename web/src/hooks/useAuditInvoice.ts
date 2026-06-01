import { useMutation } from "@tanstack/react-query";

import { apiClient } from "../lib/apiClient";
import type { Invoice } from "../lib/schemas";

export function useAuditInvoice() {
  return useMutation({
    mutationFn: (invoice: Invoice) => apiClient.auditInvoice(invoice)
  });
}
