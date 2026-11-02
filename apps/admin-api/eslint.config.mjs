import { fileURLToPath } from "url";
import path from "path";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    files: ["src/**/*.ts"],
    rules: {
      "import/no-unresolved": "off",
      "import/extensions": "off",
      "class-methods-use-this": "off",
      "comma-dangle": "off",
      "no-underscore-dangle": "off",
      "jest/expect-expect": "off",
      "no-param-reassign": "off",
      "no-unsafe-optional-chaining": "off",
      "no-shadow": "off",
      "dot-notation": "off",
      "no-console": "error",
      "no-tabs": "off",
      "no-plusplus": "off",
      "no-multi-spaces": "error",
      "no-multiple-empty-lines": "error",
      "no-trailing-spaces": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-async-promise-executor": "off",
      quotes: [
        "error",
        "double",
        {
          allowTemplateLiterals: true,
        },
      ],
      semi: "error",
    },
  },
  {
    ignores: ["dist/**", "dist-scripts/**", "node_modules/**", "*.config.js", "*.config.mjs", "pnpm-lock.yaml", "scripts/*.cjs", "src/db/types.ts", "src/db/enums.ts"],
  },
  {
    // Untyped values are flagged for review, not a build failure.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  }
);
