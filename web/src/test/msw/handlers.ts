import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/health", () => {
    return HttpResponse.json({ status: "ok" });
  }),
  http.get("*", ({ request }) => {
    if (new URL(request.url).pathname !== "/plans") {
      return;
    }
    return HttpResponse.json([
      {
        id: "starter_monthly",
        name: "Starter Monthly",
        type: "flat",
        currency: "USD",
        components: [{ id: "base", name: "Base", type: "flat" }]
      },
      {
        id: "pro_monthly",
        name: "Pro Monthly",
        type: "per_seat",
        currency: "USD",
        components: [{ id: "seat", name: "Seat", type: "per_seat" }]
      }
    ]);
  })
];
