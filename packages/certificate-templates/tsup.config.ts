import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "templates/index": "src/templates/index.ts",
    "components/index": "src/components/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "next", "qrcode.react"],
  treeshake: true,
  splitting: false,
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
});
