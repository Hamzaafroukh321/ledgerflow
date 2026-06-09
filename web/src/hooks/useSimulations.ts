import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiClient } from "../lib/apiClient";

const simulationsKey = ["simulations"] as const;
const pageSize = 25;

export function useSimulations() {
  return useQuery({
    queryKey: simulationsKey,
    queryFn: () => apiClient.listSimulations()
  });
}

export function useSimulationsPage() {
  const [cursor, setCursor] = useState<string>();
  const query = useQuery({
    queryKey: [...simulationsKey, "page", cursor],
    queryFn: () => apiClient.listSimulationsPage({ limit: pageSize, cursor })
  });
  return { ...query, cursor, nextCursor: query.data?.page.nextCursor, setCursor };
}

export function useSimulation(runId: string | undefined) {
  return useQuery({
    enabled: Boolean(runId),
    queryKey: [...simulationsKey, runId],
    queryFn: () => apiClient.getSimulation(runId as string)
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
