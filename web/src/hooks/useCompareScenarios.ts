import { useMutation } from "@tanstack/react-query";

import { apiClient } from "../lib/apiClient";

export function useCompareScenarios() {
  return useMutation({
    mutationFn: (input: unknown) => apiClient.compareScenarios(input)
  });
}
