// Root lint config: the repository's own scripts (db/, e2e/, scripts/), apps/stubs and
// the shared UI packages (packages/*/src). The three APIs carry their own
// eslint.config.mjs and the three Next apps their own .eslintrc.js, so they are
// ignored here.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/.terraform/**",
      "**/dist-scripts/**",
      "**/.local-storage/**",
      "**/playwright-report/**",
      "apps/admin/**",
      "apps/admin-api/**",
      "apps/console/**",
      "apps/console-api/**",
      "apps/learner-api/**",
      "apps/web/**",
      "packages/eslint-config/**",
      "packages/db/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-console": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
  {
    // Shared UI packages, rendered by the two Next apps.
    files: ["packages/*/src/**/*.{ts,tsx}"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      "no-console": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // next/image is each app's choice; a shared component cannot assume it.
      "@next/next/no-img-element": "off",
      // Components keep props in their public type even when one variant ignores them.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "none", ignoreRestSiblings: true, varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "@typescript-eslint/no-unused-expressions": ["error", { allowShortCircuit: true, allowTernary: true }],
      "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
    },
  },
  {
    files: ["scripts/**", "db/**", "e2e/**", "apps/stubs/**", "**/*.config.*"],
    rules: { "no-console": "off" },
  }
);
