import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../lib/apiClient";

const simulationsKey = ["simulations"] as const;

export function useSimulations() {
  return useQuery({
    queryKey: simulationsKey,
    queryFn: () => apiClient.listSimulations()
  });
}

export function useCreateSimulation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => apiClient.createSimulation(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: simulationsKey });
    }
  });
}
