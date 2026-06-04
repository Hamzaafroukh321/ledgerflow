import { timingSafeEqual } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export interface TokenAuthOptions {
  token?: string | undefined;
  serveWeb?: boolean;
}

const API_ROUTE_PREFIXES = [
  "/plans",
  "/invoices",
  "/simulations",
  "/usage",
  "/coupons",
  "/customers",
  "/subscriptions",
  "/refunds",
  "/scenarios"
];

export function registerTokenAuth(server: FastifyInstance, options: TokenAuthOptions): void {
  const token = options.token?.trim();
  if (!token) {
    return;
  }

  server.addHook("onRequest", async (request, reply) => {
    if (isPublicRequest(request, options)) {
      return;
    }

    if (matchesToken(readRequestToken(request), token)) {
      return;
    }

    await sendUnauthorized(reply);
  });
}

function isPublicRequest(request: FastifyRequest, options: TokenAuthOptions): boolean {
  if (request.method === "OPTIONS") {
    return true;
  }

  const path = request.url.split("?")[0] ?? request.url;
  if (path === "/health" || path === "/openapi.json" || path === "/docs" || path.startsWith("/docs/")) {
    return true;
  }

  if (options.serveWeb && request.method === "GET" && !isApiRoute(path)) {
    return true;
  }

  if (options.serveWeb && request.method === "GET" && acceptsHtml(request)) {
    return true;
  }

  return !isApiRoute(path);
}

function isApiRoute(path: string): boolean {
  return API_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function acceptsHtml(request: FastifyRequest): boolean {
  return request.headers.accept?.includes("text/html") === true;
}

function readRequestToken(request: FastifyRequest): string | undefined {
  const authorization = firstHeaderValue(request.headers.authorization);
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return firstHeaderValue(request.headers["x-ledgerflow-token"])?.trim();
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function matchesToken(candidate: string | undefined, expected: string): boolean {
  if (!candidate) {
    return false;
  }
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
}

async function sendUnauthorized(reply: FastifyReply): Promise<void> {
  await reply.status(401).send({
    error: {
      code: "unauthorized",
      message: "A valid LedgerFlow API token is required."
    }
  });
}
