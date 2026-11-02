import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/themes/index.ts",
    "src/sections/index.ts",
    "src/templates/index.ts",
    "src/courses/index.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
