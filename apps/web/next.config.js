const path = require("path");
function imageRemotePatterns() {
  const hosts = (process.env.NEXT_PUBLIC_IMAGE_HOSTS || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (hosts.length === 0) return [{ protocol: "https", hostname: "**" }];
  return hosts.map((hostname) => ({ protocol: "https", hostname }));
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
  webpack: (config, { isServer, webpack }) => {
    // Polyfill Promise.withResolvers for Node.js < 22. pdfjs-dist (via react-pdf)
    // calls it at module load time; the PDF reader on /book-reader/:slug pulls
    // pdfjs in. Mirrors the polyfill in apps/admin's next.config.js.
    if (isServer) {
      config.plugins.push(
        new webpack.BannerPlugin({
          banner:
            'if(!Promise.withResolvers){Promise.withResolvers=function(){let r,j;const p=new Promise((a,b)=>{r=a;j=b});return{promise:p,resolve:r,reject:j}}}',
          raw: true,
        })
      );
    }
    return config;
  },
  async redirects() {
    return [];
  },
  async rewrites() {
    // PostHog reverse proxy, only when analytics is configured.
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return [];
    const posthogHost = (process.env.POSTHOG_PROXY_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
    const posthogAssets = (process.env.POSTHOG_ASSETS_HOST || "https://us-assets.i.posthog.com").replace(/\/$/, "");
    return [
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
  transpilePackages: ["@open-mtlms/shared", "@open-mtlms/ui-config", "@open-mtlms/lms-templates", "@open-mtlms/book-templates"],
  images: {
    // Remote image hosts come from config: NEXT_PUBLIC_IMAGE_HOSTS is a comma
    // separated list of hostnames (e.g. "cdn.example.com,images.unsplash.com").
    // Unset keeps the permissive default so tenant-supplied image URLs work.
    remotePatterns: imageRemotePatterns(),
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  distDir: ".next",
  cleanDistDir: true,
};

module.exports = nextConfig;
