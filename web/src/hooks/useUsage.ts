import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../lib/apiClient";

export function useUsageEvents() {
  return useQuery({
    queryKey: ["usage-events"],
    queryFn: () => apiClient.listUsageEvents()
  });
}

export function useIngestUsage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (event: unknown) => apiClient.ingestUsage(event),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usage-events"] })
  });
}

export function useAggregateUsage() {
  return useMutation({
    mutationFn: (input: unknown) => apiClient.aggregateUsage(input)
  });
}
