import { createHash } from "node:crypto";

import type { FastifyRequest } from "fastify";

import { IdempotencyError } from "../errors/index.js";

interface StoredResponse {
  fingerprint: string;
  response: unknown;
}

export interface IdempotencyStore {
  replayOrSave(
    scope: string,
    fingerprint: string,
    work: () => Promise<unknown>
  ): Promise<{ replayed: boolean; response: unknown }>;
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly responses = new Map<string, StoredResponse>();

  public async replayOrSave(
    scope: string,
    fingerprint: string,
    work: () => Promise<unknown>
  ): Promise<{ replayed: boolean; response: unknown }> {
    const existing = this.responses.get(scope);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new IdempotencyError("Idempotency-Key was reused with a different request body.");
      }
      return { replayed: true, response: structuredClone(existing.response) };
    }

    const response = await work();
    this.responses.set(scope, { fingerprint, response: structuredClone(response) });
    return { replayed: false, response };
  }
}

export async function withIdempotency<T>(
  request: FastifyRequest,
  store: IdempotencyStore,
  work: () => Promise<T>
): Promise<{ replayed: boolean; response: T }> {
  const key = readIdempotencyKey(request);
  if (!key) {
    return { replayed: false, response: await work() };
  }

  const principal = request.principal ?? {
    subject: "open-mode",
    tenantId: "default",
    role: "admin"
  };
  const scope = [
    principal.tenantId,
    principal.subject,
    request.method.toUpperCase(),
    normalizePath(request.url.split("?")[0] ?? request.url),
    key
  ].join(":");
  const fingerprint = createHash("sha256")
    .update(stableStringify(request.body))
    .digest("hex");
  const result = await store.replayOrSave(scope, fingerprint, work);
  return { replayed: result.replayed, response: result.response as T };
}

function readIdempotencyKey(request: FastifyRequest): string | undefined {
  const value = request.headers["idempotency-key"];
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizePath(path: string): string {
  return path.startsWith("/v1/") ? path.slice("/v1".length) : path;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
