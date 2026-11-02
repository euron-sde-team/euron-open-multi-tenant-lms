import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "components/index": "src/components/index.ts",
    "hooks/index": "src/hooks/index.ts",
    "lib/index": "src/lib/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "next", "@open-mtlms/shared", "@open-mtlms/ui-config"],
  treeshake: true,
  splitting: false,
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
});
