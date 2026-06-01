import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../lib/apiClient";

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: apiClient.listPlans
  });
}
