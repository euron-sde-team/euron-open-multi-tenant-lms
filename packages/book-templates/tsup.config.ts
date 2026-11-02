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
  // pdfjs-dist and epubjs are loaded with a dynamic import at runtime, in the
  // browser. Left bundleable, tsup INLINES them (the bundle went to 1.8MB) and
  // their module-scope initialisation then runs during SSR, where there is no
  // window, crashing the whole book page with "Cannot read properties of
  // undefined". External keeps the import dynamic and browser-only.
  external: ["react", "react-dom", "next", "@open-mtlms/shared", "@open-mtlms/core", "pdfjs-dist", "epubjs"],
  treeshake: true,
  splitting: false,
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
});
