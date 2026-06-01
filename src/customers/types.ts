import type { TaxProfile } from "../tax/types.js";

export interface Customer {
  id: string;
  name: string;
  email?: string;
  taxProfile: TaxProfile;
  metadata: Record<string, string>;
}

export interface SubscriptionAssignment {
  customerId: string;
  planId: string;
  seats: number;
  startsOn: string;
  endsOn?: string;
}

export interface CustomerBillingProfile {
  customer: Customer;
  activeSubscription?: SubscriptionAssignment;
}
