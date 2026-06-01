import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: [
        "dist/**",
        "coverage/**",
        "src/cli/**",
        "src/**/*.d.ts",
        "src/**/types.ts",
        "src/plans/plan-repository.ts",
        "src/storage/repository.ts"
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 70
      }
    }
  }
});
