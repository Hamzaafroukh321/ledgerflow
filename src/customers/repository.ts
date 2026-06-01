import type { Customer, SubscriptionAssignment } from "./types.js";

export interface CustomerRepository {
  listCustomers(): Customer[];
  getCustomer(customerId: string): Customer | undefined;
  saveCustomer(customer: Customer): void;
  listSubscriptions(customerId?: string): SubscriptionAssignment[];
  saveSubscription(assignment: SubscriptionAssignment): void;
}

export class MemoryCustomerRepository implements CustomerRepository {
  private readonly customers = new Map<string, Customer>();
  private readonly subscriptions: SubscriptionAssignment[] = [];

  public listCustomers(): Customer[] {
    return [...this.customers.values()].map((customer) => structuredClone(customer));
  }

  public getCustomer(customerId: string): Customer | undefined {
    const customer = this.customers.get(customerId);
    return customer ? structuredClone(customer) : undefined;
  }

  public saveCustomer(customer: Customer): void {
    this.customers.set(customer.id, structuredClone(customer));
  }

  public listSubscriptions(customerId?: string): SubscriptionAssignment[] {
    return this.subscriptions
      .filter((assignment) => customerId === undefined || assignment.customerId === customerId)
      .map((assignment) => ({ ...assignment }));
  }

  public saveSubscription(assignment: SubscriptionAssignment): void {
    const index = this.subscriptions.findIndex((candidate) => {
      return (
        candidate.customerId === assignment.customerId &&
        candidate.planId === assignment.planId &&
        candidate.startsOn === assignment.startsOn
      );
    });
    if (index === -1) {
      this.subscriptions.push({ ...assignment });
      return;
    }
    this.subscriptions[index] = { ...assignment };
  }
}
