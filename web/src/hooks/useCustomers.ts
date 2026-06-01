import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../lib/apiClient";

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: () => apiClient.listCustomers()
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => apiClient.createCustomer(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] })
  });
}

export function useAssignSubscription() {
  return useMutation({
    mutationFn: (input: unknown) => apiClient.assignSubscription(input)
  });
}

export function useBillingProfile() {
  return useMutation({
    mutationFn: ({ customerId, onDate }: { customerId: string; onDate: string }) =>
      apiClient.getBillingProfile(customerId, onDate)
  });
}
