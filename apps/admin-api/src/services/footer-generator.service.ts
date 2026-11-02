import tenantOrgService from "./tenant-org.service";
import tenantRepository from "../repositories/tenant.repository";
import { db } from "../db/connection";
import { tenant_status } from "../db/enums";
import { getRedisClient } from "../lib/redis";
import logger from "../utils/logger";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Stable column IDs, auto-generated columns use these; custom columns never will */
const COL_PREFIX = "auto-col-";

/** Curated navigation links, clean, minimal footer */
const CURATED_NAV_LINKS: { label: string; href: string }[] = [
  { label: "Profile", href: "/profile" },
  { label: "All Courses", href: "/all-courses" },
  { label: "Books", href: "/books" },
  { label: "Bundles", href: "/bundles" },
  { label: "Test Series", href: "/test-series" },
];

/** Essential links that every tenant footer should include */
const DEFAULT_ESSENTIAL_LINKS: { label: string; href: string }[] = [
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "FAQ", href: "/faq" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

/** Social platforms shown as footer icons. Excludes website and community links (whatsapp/telegram/discord). */
const FOOTER_SOCIAL_PLATFORMS = new Set([
  "twitter", "linkedin", "youtube", "instagram", "github", "facebook",
]);

/** Interval between footer contact-info sync sweeps */
const FOOTER_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FooterColumn {
  id: string;
  title: string;
  links: { label: string; href: string }[];
}

interface GeneratedFooter {
  enabled: boolean;
  logo: string;
  logoAlt: string;
  description: string;
  columns: FooterColumn[];
  socialLinks: { platform: string; url: string; icon: string }[];
  copyright: string;
  variant: string;
  contactInfo?: { email?: string; phone?: string; address?: string };
  whatsappContacts?: { number: string; href: string }[];
  useHeaderLogo: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatAddress(address: Record<string, unknown> | null): string | undefined {
  if (!address) return undefined;
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.country,
    address.postalCode,
  ].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function isAutoColumn(id: string): boolean {
  return id.startsWith("auto-");
}

/** Extract only real social-platform links from org details (excludes website, community links) */
function buildSocialLinks(
  socialLinks: Record<string, unknown> | null
): { platform: string; url: string; icon: string }[] {
  if (!socialLinks) return [];
  const result: { platform: string; url: string; icon: string }[] = [];
  for (const [key, val] of Object.entries(socialLinks)) {
    if (FOOTER_SOCIAL_PLATFORMS.has(key) && val && typeof val === "string" && val.trim()) {
      result.push({ platform: key, url: val.trim(), icon: key });
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

class FooterGeneratorService {
  /**
   * Generate curated footer columns.
   * Returns two columns: navigation (Profile, All Courses, Books, Bundles, Blog)
   * and essential (About Us, Contact Us, FAQ, Privacy Policy, Terms of Service).
   */
  async generateFooterColumns(_tenantId: string): Promise<FooterColumn[]> {
    return [
      {
        id: `${COL_PREFIX}0`,
        title: "",
        links: [...CURATED_NAV_LINKS],
      },
      {
        id: `${COL_PREFIX}essential`,
        title: "",
        links: [...DEFAULT_ESSENTIAL_LINKS],
      },
    ];
  }

  /**
   * Generate a complete footer config from tenant data.
   */
  async generateFooter(tenantId: string): Promise<GeneratedFooter> {
    const [columns, orgDetails, tenant] = await Promise.all([
      this.generateFooterColumns(tenantId),
      tenantOrgService.getOrgDetails(tenantId),
      tenantRepository.findById(tenantId),
    ]);

    const tenantName = tenant?.name || "Your Company";
    const socialLinks = buildSocialLinks(orgDetails.socialLinks);

    const contactEmail = orgDetails.contactEmail || orgDetails.supportEmail;
    const contactPhone = orgDetails.phoneNumbers?.[0];
    const contactAddress = formatAddress(orgDetails.address);

    const contactInfo =
      contactEmail || contactPhone || contactAddress
        ? {
            email: contactEmail || undefined,
            phone: contactPhone || undefined,
            address: contactAddress,
          }
        : undefined;

    const whatsappContacts =
      orgDetails.whatsappNumbers && orgDetails.whatsappNumbers.length > 0
        ? orgDetails.whatsappNumbers.map((num) => {
            const cleanNumber = num.replace(/\s+/g, "").replace(/^\+/, "");
            return { number: num, href: `https://wa.me/${cleanNumber}` };
          })
        : undefined;

    return {
      enabled: true,
      logo: "",
      logoAlt: "",
      description: orgDetails.description || orgDetails.tagline || "",
      columns,
      socialLinks,
      copyright: `© ${new Date().getFullYear()} ${tenantName}. All rights reserved.`,
      variant: "comprehensive",
      contactInfo,
      whatsappContacts,
      useHeaderLogo: true,
    };
  }

  /**
   * Sync auto-generated footer columns into the stored layout.
   * Replaces columns with `auto-*` IDs, preserves user-customized columns.
   * Fire-and-forget safe, errors are logged, never thrown to caller.
   */
  async syncFooterColumns(tenantId: string): Promise<void> {
    try {
      const rawLayout = await tenantRepository.getLayout(tenantId);
      if (!rawLayout || typeof rawLayout !== "object") return;

      const layout = rawLayout as Record<string, unknown>;
      const footer = layout.footer as Record<string, unknown> | undefined;

      if (!footer) {
        const generatedFooter = await this.generateFooter(tenantId);
        layout.footer = generatedFooter;
        await tenantRepository.updateLayout(tenantId, layout);
        return;
      }

      const existingColumns = (footer.columns as FooterColumn[]) || [];

      if (existingColumns.length === 0) {
        const generatedFooter = await this.generateFooter(tenantId);
        layout.footer = { ...footer, ...generatedFooter };
        await tenantRepository.updateLayout(tenantId, layout);
        return;
      }

      // Has columns, replace auto columns, preserve custom columns
      const customColumns = existingColumns.filter((col) => !isAutoColumn(col.id));
      const newAutoColumns = await this.generateFooterColumns(tenantId);
      footer.columns = [...newAutoColumns, ...customColumns];

      // Social links are intentionally left as-is, empty means "none configured"

      await tenantRepository.updateLayout(tenantId, layout);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("Footer sync failed", { tenantId, error: msg });
    }
  }

  /**
   * Sync org contact details (phone, WhatsApp, email, address, social links)
   * into the stored footer config. Called after org details are updated.
   * Fire-and-forget safe, errors are logged, never thrown to caller.
   */
  async syncContactInfo(tenantId: string): Promise<void> {
    try {
      const rawLayout = await tenantRepository.getLayout(tenantId);
      if (!rawLayout || typeof rawLayout !== "object") return;

      const layout = rawLayout as Record<string, unknown>;
      const footer = layout.footer as Record<string, unknown> | undefined;
      if (!footer) return;

      const orgDetails = await tenantOrgService.getOrgDetails(tenantId);

      // Sync contact info
      const contactEmail = orgDetails.contactEmail || orgDetails.supportEmail;
      const contactPhone = orgDetails.phoneNumbers?.[0];
      const contactAddress = formatAddress(orgDetails.address);
      footer.contactInfo =
        contactEmail || contactPhone || contactAddress
          ? {
              email: contactEmail || undefined,
              phone: contactPhone || undefined,
              address: contactAddress,
            }
          : undefined;

      // Sync WhatsApp contacts
      footer.whatsappContacts =
        orgDetails.whatsappNumbers && orgDetails.whatsappNumbers.length > 0
          ? orgDetails.whatsappNumbers.map((num) => {
              const cleanNumber = num.replace(/\s+/g, "").replace(/^\+/, "");
              return { number: num, href: `https://wa.me/${cleanNumber}` };
            })
          : undefined;

      // Sync social links (only actual social platforms, excludes website/community)
      footer.socialLinks = buildSocialLinks(orgDetails.socialLinks);

      await tenantRepository.updateLayout(tenantId, layout);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("Footer contact sync failed", { tenantId, error: msg });
    }
  }

  /**
   * Re-sync footer columns for ALL active tenants.
   * Used as a one-time migration to apply curated footer links globally.
   */
  async batchResyncAllFooters(): Promise<void> {
    const tenants = await db
      .selectFrom("tenants")
      .select("id")
      .where("status", "=", tenant_status.ACTIVE)
      .execute();

    for (const tenant of tenants) {
      await this.syncFooterColumns(tenant.id);
    }
    logger.info(`Footer re-sync complete for ${tenants.length} tenants`);
  }
}

/* ------------------------------------------------------------------ */
/*  Background footer-sync sweep (5-min polling)                       */
/* ------------------------------------------------------------------ */

let syncTimer: ReturnType<typeof setTimeout> | null = null;

const FOOTER_SYNC_LOCK_KEY = "footer-sync:lock";
const FOOTER_SYNC_LOCK_TTL = 240; // seconds, shorter than 5-min interval so lock expires before next cycle

async function runFooterSyncSweep(): Promise<void> {
  try {
    const redis = await getRedisClient();
    const acquired = await redis.set(FOOTER_SYNC_LOCK_KEY, process.pid.toString(), {
      NX: true,
      EX: FOOTER_SYNC_LOCK_TTL,
    });
    if (!acquired) return; // another worker/instance holds the lock

    const tenants = await db
      .selectFrom("tenants")
      .select("id")
      .where("status", "=", tenant_status.ACTIVE)
      .execute();

    for (const tenant of tenants) {
      await footerGeneratorService.syncContactInfo(tenant.id);
    }
    logger.info(`[footer-sync] Sweep complete for ${tenants.length} tenants`);
  } catch (err) {
    logger.error("[footer-sync] Sweep error:", err);
  }
}

function scheduleSyncSweep(): void {
  runFooterSyncSweep().finally(() => {
    syncTimer = setTimeout(scheduleSyncSweep, FOOTER_SYNC_INTERVAL_MS);
  });
}

const footerGeneratorService = new FooterGeneratorService();

export function startFooterSyncSweep(): void {
  if (syncTimer) return;
  logger.info("[footer-sync] Starting background footer contact sync (first run in 30s, then every 5m)");
  syncTimer = setTimeout(scheduleSyncSweep, 30_000);
}

export function stopFooterSyncSweep(): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}

export default footerGeneratorService;
