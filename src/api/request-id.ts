import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

export function registerRequestIds(server: FastifyInstance): void {
  server.addHook("onRequest", async (request, reply) => {
    request.requestId = readRequestId(request.headers["x-request-id"]) ?? randomUUID();
    reply.header("x-request-id", request.requestId);
  });
}

function readRequestId(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}
