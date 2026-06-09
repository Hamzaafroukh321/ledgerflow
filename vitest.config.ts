import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["node_modules/**", "dist/**", "coverage/**", "web/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
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
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 90
      }
    }
  }
});
