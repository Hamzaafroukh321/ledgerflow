import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiClient } from "../lib/apiClient";

const plansKey = ["plans"] as const;
const pageSize = 25;

export function usePlans() {
  return useQuery({
    queryKey: plansKey,
    queryFn: apiClient.listPlans
  });
}

export function usePlansPage() {
  const [cursor, setCursor] = useState<string>();
  const query = useQuery({
    queryKey: [...plansKey, "page", cursor],
    queryFn: () => apiClient.listPlansPage({ limit: pageSize, cursor })
  });
  return { ...query, cursor, nextCursor: query.data?.page.nextCursor, setCursor };
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
