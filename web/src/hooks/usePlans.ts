import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../lib/apiClient";

const plansKey = ["plans"] as const;

export function usePlans() {
  return useQuery({
    queryKey: plansKey,
    queryFn: apiClient.listPlans
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => apiClient.createPlan(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: plansKey });
    }
  });
}
