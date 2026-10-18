import { defineConfig } from "oxlint"
import antiSlop from "ultracite/oxlint/anti-slop"
import core from "ultracite/oxlint/core"
import shadcn from "ultracite/oxlint/shadcn"
import solid from "ultracite/oxlint/solid"
import tanstack from "ultracite/oxlint/tanstack"
import vitest from "ultracite/oxlint/vitest"

export default defineConfig({
  extends: [core, solid, vitest, tanstack, shadcn, antiSlop],
  jsPlugins: [
    "@tanstack/eslint-plugin-query",
    "@tanstack/eslint-plugin-router",
  ],
  options: {
    typeAware: true,
    typeCheck: true,
  },
  rules: {
    "@tanstack/query/exhaustive-deps": "error",
    "@tanstack/query/infinite-query-property-order": "error",
    "@tanstack/query/mutation-property-order": "error",
    "@tanstack/query/no-rest-destructuring": "error",
    "@tanstack/query/no-unstable-deps": "error",
    "@tanstack/query/no-void-query-fn": "error",
    "@tanstack/query/stable-query-client": "error",
    "@tanstack/router/create-route-property-order": "error",
    "@tanstack/router/route-param-names": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "off",
    "eslint/complexity": "off",
    "eslint/func-style": [
      "error",
      "declaration",
      {
        allowArrowFunctions: true,
      },
    ],
    "eslint/no-console": "error",
    "eslint/no-plusplus": ["error", { allowForLoopAfterthoughts: true }],
    "eslint/no-use-before-define": "off",
    "eslint/require-unicode-regexp": "off",
    "eslint/sort-keys": "off",
    "import/consistent-type-specifier-style": "off",
    "node/callback-return": "off",
    "unicorn/no-useless-undefined": "off",
    "typescript/no-floating-promises": [
      "error",
      {
        allowForKnownSafeCalls: [
          {
            from: "package",
            name: "UseNavigateResult",
            package: "@tanstack/router-core",
          },
        ],
      },
    ],
    "typescript/no-misused-promises": [
      "error",
      { checksVoidReturn: { attributes: false } },
    ],
    "typescript/only-throw-error": [
      "error",
      {
        allow: [
          {
            from: "package",
            name: "Redirect",
            package: "@tanstack/router-core",
          },
        ],
      },
    ],
    "typescript/prefer-nullish-coalescing": [
      "error",
      { ignorePrimitives: { string: true }, ignoreBooleanCoercion: true },
    ],
    "typescript/strict-boolean-expressions": "off",
    "typescript/strict-void-return": "off",
    "unicorn/filename-case": [
      "error",
      { cases: { kebabCase: true, camelCase: true } },
    ],
  },
  overrides: [
    {
      files: [
        "**/*.{test,spec}.{ts,tsx,js,jsx}",
        "**/__tests__/**/*.{ts,tsx,js,jsx}",
        "src/test/**/*.{ts,tsx}",
        "server/test/**/*.ts",
      ],
      plugins: ["vitest"],
      rules: {
        "anti-slop/no-module-mocking": "off",
        "anti-slop/no-unknown-parameters": "off",
        "anti-slop/no-unknown-returns": "off",
        "eslint/class-methods-use-this": "off",
        "eslint/no-empty-function": "off",
        "eslint/require-await": "off",
        "promise/prefer-await-to-callbacks": "off",
        "import/first": "off",
        "typescript/await-thenable": "off",
        "typescript/consistent-type-imports": "off",
        "typescript/no-non-null-assertion": "off",
        "typescript/no-unsafe-argument": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-type-assertion": "off",
        "unicorn/no-useless-undefined": "off",
        "vitest/max-expects": "off",
        "vitest/prefer-called-with": "off",
        "vitest/prefer-describe-function-title": "off",
        "vitest/prefer-import-in-mock": "off",
        "vitest/require-mock-type-parameters": "off",
      },
    },
    {
      files: ["scripts/**/*.ts"],
      rules: {
        "eslint/no-console": "off",
      },
    },
  ],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "drizzle/**",
    "src/lib/cn-tables.ts",
  ],
})
