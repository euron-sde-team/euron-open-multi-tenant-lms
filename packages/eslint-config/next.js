/** @type {import("eslint").Linter.Config} */
// Next.js apps. eslint-config-next already registers the import, react and
// react-hooks plugins, so this config does not extend ./react.js (which would
// register a second copy of eslint-plugin-import and make ESLint refuse to run
// with a "Plugin "import" was conflicted" error under pnpm's isolated layout).
module.exports = {
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "next/core-web-vitals", "prettier"],
  env: {
    es2022: true,
    node: true,
  },
  rules: {
    "@next/next/no-html-link-for-pages": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      { prefer: "type-imports", fixStyle: "inline-type-imports" },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    // No-op callbacks (onError: () => {}) are idiomatic in React props.
    "@typescript-eslint/no-empty-function": "off",
    // The rule crashes under the typescript-eslint and ESLint 8 pairing here.
    "@typescript-eslint/no-unused-expressions": "off",
    "import/no-duplicates": "error",
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react/no-unescaped-entities": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
  },
  ignorePatterns: ["node_modules/", "dist/", ".next/", ".turbo/"],
};
