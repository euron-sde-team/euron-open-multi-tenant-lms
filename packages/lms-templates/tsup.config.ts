import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "templates/index": "src/templates/index.ts",
    "context/index": "src/context/index.ts",
    "components/index": "src/components/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "next", "@open-mtlms/shared", "@open-mtlms/core", "@open-mtlms/ui-config"],
  treeshake: true,
  splitting: false,
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
});
