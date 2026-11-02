/**
 * Site health, the platform looking at a tenant's PUBLIC site the way a
 * visitor does.
 *
 * WHY FETCH THE LIVE SITE AND NOT THE DATABASE
 * --------------------------------------------
 * Every defect this exists to catch was invisible from the database and
 * obvious from the browser: a menu link pointing at a route the web app does
 * not serve ("Roadmaps" -> /roadmaps when the listing lives at /roadmap), a
 * "Page Not Found" that answers HTTP 200, a homepage whose SEO description
 * still said "fitness, sports and coaching programs" on a technology academy
 *, the template's copy, shipped verbatim. The rows behind all of these were
 * individually valid. Only the composed, rendered site shows the lie, so the
 * check renders the site.
 *
 * WHAT A FINDING IS
 * -----------------
 * A fact a person could verify by clicking, phrased with the fix in hand,
 * because the primary consumer is the ASSISTANT: `website.audit` hands this
 * report to the planner, which then proposes nav edits, SEO rewrites or page
 * publishes through the ordinary capabilities, approval gates and all. This
 * service never mutates anything itself.
 */
import { z } from "zod";

import { generateObject } from "ai";

import { getTextModel, isAiLive } from "../lib/ai/provider";
import { storefrontUrlForSlug } from "../utils/tenant-domain.util";
import { db } from "../db/connection";
import { NotFoundError } from "../errors/not-found.error";
import logger from "../utils/logger";

export type SiteHealthSeverity = "broken" | "wrong" | "improve";

export interface SiteHealthFinding {
  severity: SiteHealthSeverity;
  /** Stable machine kind, e.g. "dead-nav-link". Used to dedupe across sweeps. */
  kind: string;
  /** Where a person would look: a URL or a named surface. */
  where: string;
  /** What is wrong, in plain words. */
  detail: string;
  /** What the assistant could do about it, naming real levers. */
  suggestion: string;
}

export interface SiteHealthReport {
  tenantId: string;
  siteUrl: string;
  checkedPages: number;
  findings: SiteHealthFinding[];
  checkedAt: string;
}

/** Placeholder junk that must never face a learner. */
const PLACEHOLDER_PATTERNS: Array<[RegExp, string]> = [
  [/\$s\d\b/, "a literal step reference like $s1"],
  [/\{\{[^}]{1,60}\}\}/, "an unrendered {{placeholder}}"],
  [/\[object Object\]/, "the text [object Object]"],
  [/\bLorem ipsum\b/i, "lorem ipsum filler"],
];

/** How many internal links to follow beyond the homepage. */
const MAX_PAGES = 25;
const FETCH_TIMEOUT_MS = 15_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function titleOf(html: string): string {
  return (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
}

class SiteHealthService {
  /** The tenant's public origin: custom/primary domain first, else the platform subdomain. */
  async resolveSiteUrl(tenantId: string): Promise<string> {
    const domain = await db
      .selectFrom("tenant_domains")
      .select(["domain_name"])
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "ACTIVE")
      .orderBy("is_primary", "desc")
      .executeTakeFirst();
    if (domain?.domain_name) return `https://${domain.domain_name}`;

    const tenant = await db
      .selectFrom("tenants")
      .select(["slug"])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    if (!tenant) throw new NotFoundError("Tenant not found");
    return storefrontUrlForSlug(tenant.slug);
  }

  private async fetchPage(url: string): Promise<{ status: number; html: string } | null> {
    try {
      // Bust the CDN. The first live run of this audit reported two links as
      // still dead AFTER the assistant had fixed them: CloudFront was serving
      // the pre-fix homepage. An auditor reading yesterday's cache re-reports
      // yesterday's defects and re-opens runs about them, so it must see the
      // origin: the query param changes the cache key on every fetch.
      const bust = `${url.includes("?") ? "&" : "?"}_shc=${Date.now()}`;
      const res = await fetch(url + bust, {
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": "LmsSiteHealth/1.0 (+tenant self-check)" },
      });
      return { status: res.status, html: await res.text() };
    } catch (err) {
      logger.warn(
        `[site-health] fetch failed ${url}: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  /** Anchor hrefs + their visible labels, internal only. */
  private internalLinks(html: string): Array<{ href: string; label: string }> {
    const out: Array<{ href: string; label: string }> = [];
    const seen = new Set<string>();
    for (const m of html.matchAll(/<a[^>]*href="(\/[^"#?]*)"[^>]*>([\s\S]{0,200}?)<\/a>/g)) {
      const href = m[1] ?? "";
      if (!href || href.startsWith("/_next") || href.startsWith("/api") || href.includes(".")) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      const label = (m[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      out.push({ href, label });
    }
    return out;
  }

  async audit(tenantId: string): Promise<SiteHealthReport> {
    const siteUrl = await this.resolveSiteUrl(tenantId);
    const findings: SiteHealthFinding[] = [];
    let checkedPages = 0;

    const home = await this.fetchPage(siteUrl + "/");
    if (!home || home.status >= 500) {
      findings.push({
        severity: "broken",
        kind: "site-unreachable",
        where: siteUrl,
        detail: home
          ? `The homepage answered HTTP ${home.status}.`
          : "The homepage did not answer at all.",
        suggestion:
          "This is above content fixes, check the site deployment and the domain's DNS before anything else.",
      });
      return { tenantId, siteUrl, checkedPages: 1, findings, checkedAt: new Date().toISOString() };
    }
    checkedPages += 1;

    const homeText = stripHtml(home.html);

    /* ---- placeholder junk on the homepage --------------------------- */
    for (const [re, label] of PLACEHOLDER_PATTERNS) {
      const m = homeText.match(re);
      if (m) {
        findings.push({
          severity: "broken",
          kind: "placeholder-text",
          where: `${siteUrl}/`,
          detail: `The homepage shows ${label}: "…${homeText
            .slice(Math.max(0, (m.index ?? 0) - 30), (m.index ?? 0) + 50)
            .trim()}…"`,
          suggestion: "Edit the affected section so real copy replaces the placeholder.",
        });
      }
    }

    /* ---- the homepage's own SEO description ------------------------- */
    const homePage = await db
      .selectFrom("tenant_pages")
      .select(["seo"])
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", "home")
      .executeTakeFirst();
    const seo = (homePage?.seo ?? {}) as { description?: string };
    if (!seo.description || seo.description.trim().length < 20) {
      findings.push({
        severity: "improve",
        kind: "seo-description-missing",
        where: `${siteUrl}/ (SEO description)`,
        detail: "The homepage has no real SEO description, so search results write their own.",
        suggestion:
          "Set one sentence that says what this academy teaches and for whom (website.pages.update on the home page).",
      });
    } else {
      // DOES THE DESCRIPTION DESCRIBE THIS SITE?
      // -----------------------------------------
      // The defect that motivated this whole check: a technology academy whose
      // meta description still read "fitness, sports and coaching programs".
      // the template's copy, valid in every database sense, wrong to every
      // search engine and visitor. No string table catches "valid words about
      // the wrong business", so this one signal is a model judgment: shown the
      // rendered homepage's own headline and copy, does the description talk
      // about the same business? The audit only REPORTS, every fix still goes
      // through capabilities and their approval gates, so a wrong judgment
      // here costs a sentence in a report, not a mutation.
      try {
        // A judgment call needs a real model; skipped in offline mode.
        const value = isAiLive()
          ? (
              await generateObject({
                model: getTextModel("site_health"),
                schema: z.object({
                  matches: z
                    .boolean()
                    .describe("True when the description talks about the same business the page shows."),
                  reason: z.string().describe("One sentence, for the site owner."),
                }),
                system:
                  "You check whether a site's meta description describes the same business as its rendered homepage. Mismatched industry, audience or subject means false. Wording style does not matter.",
                prompt: `Meta description: ${seo.description}\n\nHomepage headline and copy: ${homeText.slice(0, 700)}`,
              })
            ).object
          : { matches: true, reason: "" };
        if (!value.matches) {
          findings.push({
            severity: "wrong",
            kind: "seo-description-mismatch",
            where: `${siteUrl}/ (SEO description)`,
            detail: `The homepage's search-result description does not describe this site: "${seo.description}", ${value.reason}`,
            suggestion:
              "Rewrite the home page's SEO description to say what this academy actually teaches (website.pages.update on the home page).",
          });
        }
      } catch (err) {
        logger.warn(
          `[site-health] seo coherence check skipped: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    /* ---- every link a visitor can see ------------------------------- */
    const links = this.internalLinks(home.html).slice(0, MAX_PAGES);
    for (const { href, label } of links) {
      const page = await this.fetchPage(siteUrl + href);
      checkedPages += 1;
      if (!page) {
        findings.push({
          severity: "broken",
          kind: "dead-nav-link",
          where: `${siteUrl}${href}`,
          detail: `The "${label || href}" link did not answer.`,
          suggestion: "Point the link somewhere that exists, or remove it (website.nav.remove).",
        });
        continue;
      }
      const title = titleOf(page.html);
      if (page.status >= 400 || /page not found|not found/i.test(title)) {
        findings.push({
          severity: "broken",
          kind: "dead-nav-link",
          where: `${siteUrl}${href}`,
          detail: `The "${label || href}" link lands on "${title || `HTTP ${page.status}`}", a visitor clicking it gets nothing.`,
          suggestion:
            "Point the link at the page that actually serves this content, or take it out of the menu until the page exists (website.nav.remove / website.nav.add).",
        });
        continue;
      }
      const text = stripHtml(page.html);
      for (const [re, plabel] of PLACEHOLDER_PATTERNS) {
        const m = text.match(re);
        if (m) {
          findings.push({
            severity: "broken",
            kind: "placeholder-text",
            where: `${siteUrl}${href}`,
            detail: `This page shows ${plabel}.`,
            suggestion: "Edit the affected section so real copy replaces the placeholder.",
          });
        }
      }
    }

    return {
      tenantId,
      siteUrl,
      checkedPages,
      findings,
      checkedAt: new Date().toISOString(),
    };
  }
}

export default new SiteHealthService();
