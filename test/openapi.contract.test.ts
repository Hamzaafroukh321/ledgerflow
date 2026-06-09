import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildServer } from "../src/index.js";

describe("OpenAPI contract", () => {
  it("matches the committed snapshot", async () => {
    const server = buildServer();
    await server.ready();
    try {
      expect(stableStringify(server.swagger())).toBe(
        normalizeNewlines(readFileSync(join("test", "openapi", "openapi.snapshot.json"), "utf8"))
      );
    } finally {
      await server.close();
    }
  });
});

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function stableStringify(value: unknown): string {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stable(nested)])
    );
  }
  return value;
}
