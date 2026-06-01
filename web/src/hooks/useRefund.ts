import { useMutation } from "@tanstack/react-query";

import { apiClient } from "../lib/apiClient";

export function useRefundSimulation() {
  return useMutation({
    mutationFn: (input: unknown) => apiClient.simulateRefund(input)
  });
}
