import { timingSafeEqual } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export interface Principal {
  subject: string;
  tenantId: string;
  role: "viewer" | "editor" | "admin";
}

export interface TokenAuthOptions {
  token?: string | undefined;
  tokens?: string | undefined;
  serveWeb?: boolean;
  warnOpenMode?: (message: string) => void;
}

interface TokenPrincipal {
  token: string;
  principal: Principal;
}

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
  }
}

export function registerTokenAuth(server: FastifyInstance, options: TokenAuthOptions): void {
  const token = options.token?.trim();
  const tokenMap = parseTokenMap(options.tokens);
  if (!token && tokenMap.length === 0) {
    options.warnOpenMode?.("LEDGERFLOW_API_TOKEN is unset; API authentication is in open mode.");
    return;
  }

  server.addHook("onRequest", async (request, reply) => {
    if (isPublicRequest(request, options)) {
      return;
    }

    const requestToken = readRequestToken(request);
    const mappedPrincipal = findMappedPrincipal(requestToken, tokenMap);
    if (mappedPrincipal) {
      request.principal = mappedPrincipal;
      return;
    }

    if (token && matchesToken(requestToken, token)) {
      request.principal = { subject: "api-token", tenantId: "default", role: "admin" };
      return;
    }

    await sendUnauthorized(reply, request.requestId);
  });
}

function parseTokenMap(value: string | undefined): TokenPrincipal[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [token, tenantId, subject = "api-token", role = "admin"] = entry.split(":");
      if (!token?.trim() || !tenantId?.trim()) {
        throw new Error("LEDGERFLOW_API_TOKENS entries must use token:tenantId[:subject[:role]]");
      }
      if (role !== "viewer" && role !== "editor" && role !== "admin") {
        throw new Error("LEDGERFLOW_API_TOKENS role must be viewer, editor, or admin");
      }
      return {
        token: token.trim(),
        principal: { subject: subject.trim(), tenantId: tenantId.trim(), role }
      };
    });
}

function findMappedPrincipal(
  token: string | undefined,
  principals: TokenPrincipal[]
): Principal | undefined {
  return principals.find((entry) => matchesToken(token, entry.token))?.principal;
}

function isPublicRequest(request: FastifyRequest, options: TokenAuthOptions): boolean {
  if (request.method === "OPTIONS") {
    return true;
  }

  const path = request.url.split("?")[0] ?? request.url;
  if (path === "/health" || path === "/openapi.json" || path === "/docs" || path.startsWith("/docs/")) {
    return true;
  }

  if (options.serveWeb && request.method === "GET" && acceptsHtml(request)) {
    return true;
  }

  if (options.serveWeb && request.method === "GET" && !isApiPath(path)) {
    return true;
  }

  return false;
}

function isApiPath(path: string): boolean {
  const normalized = path.startsWith("/v1/") ? path.slice("/v1".length) : path;
  return normalized.startsWith("/plans")
    || normalized.startsWith("/invoices")
    || normalized.startsWith("/simulations")
    || normalized.startsWith("/usage")
    || normalized.startsWith("/coupons")
    || normalized.startsWith("/customers")
    || normalized.startsWith("/subscriptions")
    || normalized.startsWith("/refunds")
    || normalized.startsWith("/scenarios")
    || normalized.startsWith("/memberships");
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

async function sendUnauthorized(reply: FastifyReply, requestId: string): Promise<void> {
  await reply.status(401).send({
    error: {
      code: "unauthorized",
      message: "A valid LedgerFlow API token is required.",
      requestId
    }
  });
}
