import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "web/**",
      "ledgerflow.zip"
    ]
  },
  js.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: rootDir,
        sourceType: "module"
      },
      globals: globals.node
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      ...tsPlugin.configs["eslint-recommended"].overrides[0].rules,
      ...tsPlugin.configs.strict.rules,
      ...tsPlugin.configs.stylistic.rules,
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  },
  {
    files: ["scripts/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module"
      },
      globals: globals.node
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      ...tsPlugin.configs["eslint-recommended"].overrides[0].rules,
      ...tsPlugin.configs.strict.rules,
      ...tsPlugin.configs.stylistic.rules,
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  },
  {
    files: ["*.config.js", "scripts/**/*.js"],
    languageOptions: {
      globals: globals.node
    }
  }
];
