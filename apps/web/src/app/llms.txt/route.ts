import { BRAND_NAME } from "@/lib/brand";
import { headers } from "next/headers";

import { getTenantHost } from "@/lib/template.server";

/**
 * Per-tenant `/llms.txt`, the emerging standard (llmstxt.org) that AI search
 * crawlers (GPTBot, PerplexityBot, ClaudeBot, Google-Extended, etc.) read to
 * understand a site and surface it in AI answers. Mirrors `sitemap.ts`: same
 * tenant resolution + published-content endpoints, so it's automatic and
 * on-by-default for every tenant with zero config. Plain-text markdown.
 */
export const dynamic = "force-dynamic";

const API_URL = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL);

interface ContentItem {
  slug: string;
  title: string;
  description?: string;
}

async function fetchList(
  url: string,
  mapper: (item: Record<string, string>) => ContentItem,
): Promise<ContentItem[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data)
      ? data
      : (data.data ?? data.items ?? data.bundles ?? data.posts ?? []);
    if (!Array.isArray(items)) return [];
    return items
      .map(mapper)
      .filter((i: ContentItem) => Boolean(i.slug && i.title));
  } catch {
    return [];
  }
}

function clean(text?: string): string | undefined {
  if (!text) return undefined;
  // One-line, no markdown-breaking chars.
  return text.replace(/\s+/g, " ").replace(/[[\]()]/g, "").trim().slice(0, 160);
}

export async function GET() {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id");
  const host = (await getTenantHost()) || "localhost:3620";
  const protocol =
    process.env.NEXT_PUBLIC_NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  const siteName = host
    .replace(/^www\./, "")
    .split(".")[0]
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const headersOut = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600, s-maxage=3600",
  };

  if (!tenantId || !API_URL) {
    const body = `# ${siteName}\n\n> Online learning platform.\n\n- [Home](${baseUrl})\n`;
    return new Response(body, { headers: headersOut });
  }

  const [courses, books, bundles, pages] = await Promise.all([
    fetchList(`${API_URL}/courses/${tenantId}?published=true`, (c) => ({
      slug: c.slug,
      title: c.title || c.name,
      description: clean(c.subtitle || c.shortDescription || c.short_description),
    })),
    fetchList(`${API_URL}/books/${tenantId}?published=true`, (b) => ({
      slug: b.slug,
      title: b.title || b.name,
      description: clean(b.subtitle || b.short_description),
    })),
    fetchList(`${API_URL}/bundles/${tenantId}?published=true`, (b) => ({
      slug: b.slug,
      title: b.title || b.name,
    })),
    fetchList(`${API_URL}/pages/${tenantId}?published=true`, (p) => ({
      slug: p.slug,
      title: p.title || p.name,
    })),
  ]);

  const lines: string[] = [
    `# ${siteName}`,
    "",
    `> ${siteName} is an online learning platform offering courses, books, bundles and test series. Powered by ${BRAND_NAME}.`,
    "",
    `- [Home](${baseUrl})`,
    `- [All courses](${baseUrl}/all-courses)`,
    "",
  ];

  if (courses.length) {
    lines.push("## Courses");
    for (const c of courses) {
      lines.push(
        `- [${c.title}](${baseUrl}/courses/${c.slug})${c.description ? `: ${c.description}` : ""}`,
      );
    }
    lines.push("");
  }
  if (books.length) {
    lines.push("## Books");
    for (const b of books) {
      lines.push(
        `- [${b.title}](${baseUrl}/books/${b.slug})${b.description ? `: ${b.description}` : ""}`,
      );
    }
    lines.push("");
  }
  if (bundles.length) {
    lines.push("## Bundles");
    for (const b of bundles) {
      lines.push(`- [${b.title}](${baseUrl}/bundles/${b.slug})`);
    }
    lines.push("");
  }

  const contentPages = pages.filter((p) => {
    const isHome = !p.slug || p.slug === "/" || p.slug === "home";
    const isPrefixed =
      p.slug.startsWith("courses/") ||
      p.slug.startsWith("books/");
    return !isHome && !isPrefixed;
  });
  if (contentPages.length) {
    lines.push("## Pages");
    for (const p of contentPages) {
      lines.push(`- [${p.title}](${baseUrl}/${p.slug})`);
    }
    lines.push("");
  }

  return new Response(lines.join("\n"), { headers: headersOut });
}
