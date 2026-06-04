import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { Principal } from "./auth.js";

type Permission = "read" | "write" | "admin";

const rolePermissions: Record<Principal["role"], Set<Permission>> = {
  viewer: new Set(["read"]),
  editor: new Set(["read", "write"]),
  admin: new Set(["read", "write", "admin"])
};

export function registerRbac(server: FastifyInstance): void {
  server.addHook("preHandler", async (request, reply) => {
    const required = requiredPermission(request);
    if (!required || isPublic(request)) {
      return;
    }
    const principal = request.principal;
    if (!principal) {
      return;
    }
    if (!rolePermissions[principal.role].has(required)) {
      await sendForbidden(reply, required, request.requestId);
    }
  });
}

function requiredPermission(request: FastifyRequest): Permission | undefined {
  const method = request.method.toUpperCase();
  const path = request.url.split("?")[0] ?? request.url;

  if (method === "GET") {
    return path === "/memberships" ? "admin" : "read";
  }

  if (
    method === "POST" &&
    (path === "/invoices/simulate" ||
      path === "/invoices/audit" ||
      path === "/scenarios/compare" ||
      path === "/usage/aggregate" ||
      path === "/coupons/validate" ||
      path === "/refunds/simulate")
  ) {
    return "read";
  }

  if (
    method === "POST" &&
    (path === "/plans" ||
      path === "/usage/events" ||
      path === "/customers" ||
      path === "/subscriptions" ||
      path === "/simulations")
  ) {
    return "write";
  }

  if (method === "POST" && path === "/memberships") {
    return "admin";
  }

  return undefined;
}

function isPublic(request: FastifyRequest): boolean {
  const path = request.url.split("?")[0] ?? request.url;
  return path === "/health" || path === "/openapi.json" || path === "/docs" || path.startsWith("/docs/");
}

async function sendForbidden(
  reply: FastifyReply,
  required: Permission,
  requestId: string
): Promise<void> {
  await reply.status(403).send({
    error: {
      code: "forbidden",
      message: `This action requires ${required} permission.`,
      requestId
    }
  });
}
