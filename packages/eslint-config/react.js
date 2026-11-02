/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["./base.js", "plugin:react/recommended", "plugin:react-hooks/recommended"],
  plugins: ["react", "react-hooks"],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react/no-unescaped-entities": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
  },
};
