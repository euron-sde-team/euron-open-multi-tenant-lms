import type { MetadataRoute } from "next";
import { getTenantHost } from "@/lib/template.server";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = await getTenantHost() || "localhost:3620";

  // Determine base URL
  const protocol = process.env.NEXT_PUBLIC_NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Internal / build paths
          "/api/",
          "/_next/",
          // Auth-protected / private user pages
          "/dashboard/",
          "/checkout/",
          "/account/",
          "/my-learning/",
          "/profile/",
          "/cart/",
          "/bookmark/",
          "/learn/",
          "/book-reader/",
          "/maintenance/",
          "/404/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
