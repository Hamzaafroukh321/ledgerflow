import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/health", () => {
    return HttpResponse.json({ status: "ok" });
  }),
  http.get("*", ({ request }) => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/plans") {
      return HttpResponse.json(plans);
    }
    if (pathname === "/v1/plans") {
      return HttpResponse.json({ data: plans, page: { limit: 25, total: plans.length, nextCursor: null } });
    }
    if (pathname === "/v1/coupons") {
      return HttpResponse.json({
        data: [{ code: "SAVE20", kind: "percent", value: 20, stackable: true }],
        page: { limit: 25, total: 1, nextCursor: null }
      });
    }
  })
];

const plans = [
  {
    id: "starter_monthly",
    name: "Starter Monthly",
    type: "flat",
    currency: "USD",
    components: [
      { id: "base", name: "Base", type: "flat", currency: "USD", unitAmountMinor: 2900 }
    ]
  },
  {
    id: "pro_monthly",
    name: "Pro Monthly",
    type: "per_seat",
    currency: "USD",
    components: [
      { id: "seat", name: "Seat", type: "per_seat", currency: "USD", unitAmountMinor: 1999 }
    ]
  }
];
