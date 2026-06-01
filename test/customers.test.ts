import { describe, expect, it } from "vitest";

import {
  assignSubscription,
  createCustomer,
  MemoryCustomerRepository,
  resolveBillingProfile
} from "../src/index.js";

describe("customer billing profiles", () => {
  it("creates customers and resolves active subscription profiles", () => {
    const customer = createCustomer({
      id: "cus_1",
      name: "Acme",
      email: "billing@example.com",
      taxProfile: { exempt: false, jurisdiction: "US-CA" },
      metadata: { segment: "growth" }
    });
    const assignment = assignSubscription({
      customerId: "cus_1",
      planId: "pro_monthly",
      seats: 5,
      startsOn: "2025-01-01"
    });

    expect(resolveBillingProfile(customer, [assignment], "2025-01-15")).toEqual({
      customer,
      activeSubscription: assignment
    });
  });

  it("uses the latest active subscription assignment", () => {
    const customer = createCustomer({
      id: "cus_1",
      name: "Acme",
      taxProfile: { exempt: false, jurisdiction: "US-CA" }
    });
    const older = assignSubscription({
      customerId: "cus_1",
      planId: "starter_monthly",
      seats: 1,
      startsOn: "2025-01-01"
    });
    const newer = assignSubscription({
      customerId: "cus_1",
      planId: "pro_monthly",
      seats: 3,
      startsOn: "2025-01-10"
    });

    expect(resolveBillingProfile(customer, [older, newer], "2025-01-15").activeSubscription).toEqual(
      newer
    );
  });

  it("stores customers and assignments in memory", () => {
    const repository = new MemoryCustomerRepository();
    const customer = createCustomer({
      id: "cus_1",
      name: "Acme",
      taxProfile: { exempt: true, jurisdiction: "US-CA" }
    });
    const assignment = assignSubscription({
      customerId: "cus_1",
      planId: "starter_monthly",
      seats: 1,
      startsOn: "2025-01-01"
    });

    repository.saveCustomer(customer);
    repository.saveSubscription(assignment);

    expect(repository.listCustomers()).toEqual([customer]);
    expect(repository.listSubscriptions("cus_1")).toEqual([assignment]);
  });

  it("rejects invalid customer and subscription input", () => {
    expect(() =>
      createCustomer({
        id: "cus_1",
        name: "Acme",
        email: "bad",
        taxProfile: { exempt: true, jurisdiction: "US-CA" }
      })
    ).toThrow(/email/);
    expect(() =>
      assignSubscription({
        customerId: "cus_1",
        planId: "starter_monthly",
        seats: 1,
        startsOn: "2025-02-01",
        endsOn: "2025-01-01"
      })
    ).toThrow(/after start/);
  });
});
