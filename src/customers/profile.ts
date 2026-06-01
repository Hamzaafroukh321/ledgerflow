import type { TaxProfile } from "../tax/types.js";
import type { Customer, CustomerBillingProfile, SubscriptionAssignment } from "./types.js";

export function createCustomer(input: {
  id: string;
  name: string;
  email?: string;
  taxProfile: TaxProfile;
  metadata?: Record<string, string>;
}): Customer {
  if (!input.id.trim()) {
    throw new Error("Customer id is required");
  }
  if (!input.name.trim()) {
    throw new Error("Customer name is required");
  }
  if (input.email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) {
    throw new Error("Customer email is invalid");
  }

  const customer: Customer = {
    id: input.id,
    name: input.name,
    taxProfile: input.taxProfile,
    metadata: input.metadata ?? {}
  };
  if (input.email !== undefined) {
    customer.email = input.email;
  }
  return customer;
}

export function assignSubscription(input: SubscriptionAssignment): SubscriptionAssignment {
  if (!input.customerId.trim() || !input.planId.trim()) {
    throw new Error("Subscription assignment requires customerId and planId");
  }
  if (!Number.isInteger(input.seats) || input.seats < 0) {
    throw new Error("Subscription seats must be a non-negative integer");
  }
  if (Date.parse(input.startsOn) >= Date.parse(input.endsOn ?? "9999-12-31")) {
    throw new Error("Subscription end must be after start");
  }
  return { ...input };
}

export function resolveBillingProfile(
  customer: Customer,
  assignments: SubscriptionAssignment[],
  onDate: string
): CustomerBillingProfile {
  const timestamp = Date.parse(onDate);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid profile date: ${onDate}`);
  }

  const active = assignments
    .filter((assignment) => assignment.customerId === customer.id)
    .filter((assignment) => {
      const start = Date.parse(assignment.startsOn);
      const end = assignment.endsOn ? Date.parse(assignment.endsOn) : Number.POSITIVE_INFINITY;
      return start <= timestamp && timestamp < end;
    })
    .sort((left, right) => Date.parse(right.startsOn) - Date.parse(left.startsOn))[0];

  const profile: CustomerBillingProfile = { customer };
  if (active !== undefined) {
    profile.activeSubscription = active;
  }
  return profile;
}
