const path = require("path");

module.exports = {
  extends: ["@open-mtlms/eslint-config/next"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "@typescript-eslint/no-unused-expressions": "off",
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
};
