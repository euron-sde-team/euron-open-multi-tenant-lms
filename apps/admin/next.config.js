const path = require("path");

// onnxruntime-web (pulled in by @imgly/background-removal's dynamic
// `import("onnxruntime-web")` / `import("onnxruntime-web/webgpu")` for the
// thumbnail background remover) ships pre-minified ESM worker bundles
// (ort.*.bundle.min.mjs). Because they contain `new Worker(new URL(...,
// import.meta.url))` and `new URL("...wasm", import.meta.url)`, webpack emits
// them verbatim as `static/media/*.mjs` assets. Next's Terser pass then parses
// every emitted `.mjs` as a *script* and dies on the top-level `import.meta` /
// `export`. The files are already minified, so we mark them `minimized` before
// the Terser stage runs: Next's TerserPlugin skips assets flagged minimized,
// and the bundle is emitted as-is (which is what `new Worker(url, {type:"module"})`
// expects at runtime).
class SkipOnnxModuleMinifyPlugin {
  apply(compiler) {
    const { Compilation } = compiler.webpack;
    compiler.hooks.compilation.tap("SkipOnnxModuleMinify", (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: "SkipOnnxModuleMinify",
          // Runs before PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE, where Terser taps.
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
        },
        (assets) => {
          for (const name of Object.keys(assets)) {
            const isEmittedEsmAsset =
              /\.mjs$/i.test(name) && (name.includes("static/media/") || /(^|\/)ort[.\-]/i.test(name));
            if (!isEmittedEsmAsset) continue;
            const asset = compilation.getAsset(name);
            if (asset && !asset.info.minimized) {
              compilation.updateAsset(name, asset.source, { ...asset.info, minimized: true });
            }
          }
        }
      );
    });
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for container images. Tracing starts at the
  // monorepo root so workspace packages are copied into the standalone output.
  output: "standalone",
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../.."),
  },
  transpilePackages: ["@open-mtlms/shared", "@open-mtlms/ui-config", "@open-mtlms/core", "@open-mtlms/lms-templates"],
  webpack: (config, { isServer, webpack }) => {
    // Polyfill Promise.withResolvers for Node.js < 22.
    // pdfjs-dist (via react-pdf) uses it at module level; injecting into every
    // server chunk ensures it exists before any module evaluation.
    if (isServer) {
      config.plugins.push(
        new webpack.BannerPlugin({
          banner:
            'if(!Promise.withResolvers){Promise.withResolvers=function(){let r,j;const p=new Promise((a,b)=>{r=a;j=b});return{promise:p,resolve:r,reject:j}}}',
          raw: true,
        })
      );
    }
    // konva (react-konva, thumbnail composer) has an optional "canvas" node
    // dependency that must not be bundled, it only runs client-side.
    config.resolve = config.resolve || {};
    config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false };
    // Skip minifying onnxruntime-web's pre-minified ESM worker bundles (client only).
    if (!isServer) {
      config.plugins.push(new SkipOnnxModuleMinifyPlugin());
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  eslint: {
    // Pre-existing warnings (80+) across the codebase; lint is run separately via `pnpm lint`
    ignoreDuringBuilds: true,
  },
  // Isolate build cache to prevent conflicts in monorepo
  distDir: ".next",
  // Clean build cache on each build to prevent stale cache issues
  cleanDistDir: true,
  // Proxy API requests through Next.js server to avoid CORS issues
  // Browser calls /api/proxy/... -> Next.js rewrites to backend API
  async rewrites() {
    const apiUrl = (
      process.env.API_PROXY_TARGET ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:5086/api/v1"
    ).replace(/\/+$/, "");
    const rules = [
      {
        source: "/api/proxy/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
    // PostHog reverse proxy, only when analytics is configured.
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return rules;
    const posthogHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/+$/, "");
    const posthogAssets = posthogHost.replace("://us.i.", "://us-assets.i.").replace("://eu.i.", "://eu-assets.i.");
    return [
      ...rules,
      {
        source: "/ingest/static/:path*",
        destination: `${posthogAssets}/static/:path*`,
      },
      {
        source: "/ingest/decide",
        destination: `${posthogHost}/decide`,
      },
      {
        source: "/ingest/:path*",
        destination: `${posthogHost}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
