import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const text = (path: string) => readFileSync(path, "utf8");

describe("release readiness artifacts", () => {
  it("keeps package, CLI, and OpenAPI versions aligned", () => {
    const packageJson = JSON.parse(text("package.json")) as { version: string };

    expect(packageJson.version).toBe("0.2.0");
    expect(text("package-lock.json")).toContain('"version": "0.2.0"');
    expect(text("src/cli/index.ts")).toContain('.version("0.2.0")');
    expect(text("src/api/server.ts")).toContain('version: "0.2.0"');
  });

  it("requires API authentication in the production compose profile", () => {
    const compose = text("docker-compose.prod.yml");

    expect(compose).toContain("LEDGERFLOW_API_TOKEN: ${LEDGERFLOW_API_TOKEN:?");
    expect(compose).toContain("LEDGERFLOW_DB_URL");
    expect(compose).not.toMatch(/5432:5432/);
  });

  it("runs the release stack against Postgres and persistent volumes", () => {
    const compose = text("docker-compose.prod.yml");

    expect(compose).toContain("postgres://ledgerflow@postgres:5432/ledgerflow");
    expect(compose).toContain("ledgerflow-postgres:/var/lib/postgresql/data");
    expect(compose).toContain("condition: service_healthy");
  });

  it("hardens the runtime container profile", () => {
    const compose = text("docker-compose.prod.yml");

    expect(compose).toContain("read_only: true");
    expect(compose).toContain("tmpfs:");
    expect(compose).toContain("restart: unless-stopped");
  });

  it("verifies release startup, auth, readiness, and seeded catalog access", () => {
    const verifier = text("scripts/verify-release.ps1");

    expect(verifier).toContain("docker compose -p $ProjectName -f docker-compose.prod.yml up -d --build");
    expect(verifier).toContain("/v1/plans");
    expect(verifier).toContain("/ready");
    expect(verifier).toContain("Authorization = \"Bearer $Token\"");
  });

  it("documents deploy-from-scratch, upgrade, rollback, and operations checks", () => {
    const runbook = text("docs/production-runbook.md");

    expect(runbook).toContain("Deploy From Scratch");
    expect(runbook).toContain("Upgrade");
    expect(runbook).toContain("Rollback");
    expect(runbook).toContain("Runtime Operations");
  });

  it("documents the product threat model and no-money-movement boundary", () => {
    const threatModel = text("docs/threat-model.md");

    expect(threatModel).toContain("Trust Boundaries");
    expect(threatModel).toContain("Tenant isolation");
    expect(threatModel).toContain("does not charge cards");
    expect(threatModel).toMatch(/never\s+moves money/);
  });

  it("records the 0.2.0 release in the changelog and checklist", () => {
    expect(text("docs/CHANGELOG.md")).toContain("## 0.2.0");
    expect(text("docs/release-checklist.md")).toContain("git tag v0.2.0");
    expect(text("README.md")).toContain("docker-compose.prod.yml");
  });
});
