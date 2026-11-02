const path = require("path");

module.exports = {
  root: true,
  extends: ["@open-mtlms/eslint-config/next"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  settings: {
    "import/resolver": {
      typescript: {
        project: path.resolve(__dirname, "tsconfig.json"),
      },
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
    },
  },
  rules: {
    "import/order": "off",
    "react/no-unescaped-entities": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-expressions": "off",
  },
};
