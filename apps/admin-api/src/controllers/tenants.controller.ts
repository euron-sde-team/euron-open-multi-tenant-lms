import { Request, Response } from "express";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import tenantRepository from "../repositories/tenant.repository";
import footerGeneratorService from "../services/footer-generator.service";
import { IResponseFormat } from "../types/response.type";
import logger from "../utils/logger";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

// Response type for tenant lookup
interface TenantLookupResponse {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  status: string;
  isActive: boolean;
}

/**
 * Map tenant to lookup response
 */
const mapToLookupResponse = (tenant: {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  status: string;
}): TenantLookupResponse => ({
  id: tenant.id,
  name: tenant.name,
  slug: tenant.slug,
  customDomain: tenant.custom_domain,
  status: tenant.status,
  isActive: tenant.status === "ACTIVE",
});

/**
 * Get tenant by slug (for subdomain lookup)
 * GET /tenants/slug/:slug
 */
export const getTenantBySlug = async (req: Request, res: Response<IResponseFormat>) => {
  const { slug } = req.params;

  const tenant = await tenantRepository.findBySlug(slug as string);

  if (!tenant) {
    throw new NotFoundError("Tenant not found");
  }

  sendSuccessResponse({
    res,
    data: mapToLookupResponse(tenant),
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant retrieved successfully",
  });
};

/**
 * Get tenant by custom domain
 * GET /tenants/domain/:domain
 *
 * Lookup order: tenant_domains (ACTIVE) first, then tenants.custom_domain (legacy).
 * Supports apex (abc.com), www (www.abc.com), and subdomains (learn.abc.com).
 */
export const getTenantByDomain = async (req: Request, res: Response<IResponseFormat>) => {
  const domain = (req.params.domain as string).split(":")[0].toLowerCase();

  // 1. Try tenant_domains first (custom domains + platform subdomains)
  let tenant = await tenantRepository.findByDomainName(domain);

  // 2. If hostname has www. prefix, try root domain (apex + www share resolution)
  if (!tenant && domain.startsWith("www.")) {
    tenant = await tenantRepository.findByDomainName(domain.slice(4));
  }

  // 3. Fallback to legacy tenants.custom_domain
  if (!tenant) {
    tenant = await tenantRepository.findByCustomDomain(domain);
  }
  if (!tenant && domain.startsWith("www.")) {
    tenant = await tenantRepository.findByCustomDomain(domain.slice(4));
  }

  if (!tenant) {
    throw new NotFoundError("Tenant not found");
  }

  sendSuccessResponse({
    res,
    data: mapToLookupResponse(tenant),
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant retrieved successfully",
  });
};

/**
 * Get tenant by ID
 * GET /tenants/:id
 */
export const getTenantById = async (req: Request, res: Response<IResponseFormat>) => {
  const { id } = req.params;

  const tenant = await tenantRepository.findById(id as string);

  if (!tenant) {
    throw new NotFoundError("Tenant not found");
  }

  sendSuccessResponse({
    res,
    data: mapToLookupResponse(tenant),
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant retrieved successfully",
  });
};

const DEFAULT_HEADER = {
  enabled: true,
  logo: "",
  logoAlt: "",
  navItems: [],
  showDarkModeToggle: true,
  variant: "dashboard",
  sticky: true,
  searchBar: { enabled: true, placeholder: "Search courses, instructors, topics..." },
  profileDropdown: { enabled: true, showAvatar: true, showName: true, menuItems: [] },
  showNotifications: true,
};

const DEFAULT_FOOTER = {
  enabled: true,
  logo: "",
  logoAlt: "",
  description: "",
  columns: [],
  socialLinks: [],
  copyright: `© ${new Date().getFullYear()} All rights reserved.`,
  variant: "simple",
  useHeaderLogo: true,
};

const DEFAULT_SIDEBAR = {
  enabled: true,
  position: "left",
  width: "280px",
  collapsible: true,
  defaultCollapsed: true,
  showLogo: false,
  logoSize: "md",
  navItems: [],
  widgets: [],
};

const DEFAULT_TOPBAR = {
  enabled: false,
  content: { type: "text", text: "" },
  dismissible: false,
};

/**
 * Ensures a layout from the DB has all required sections by
 * merging with sensible defaults. Handles new tenants that only
 * have a partial layout (e.g. sidebar.navItems seeded by sidebar service).
 */
function ensureCompleteLayout(layout: unknown): unknown {
  if (!layout || typeof layout !== "object") return null;
  const l = layout as Record<string, unknown>;

  return {
    ...l,
    header: l.header ?? DEFAULT_HEADER,
    footer: l.footer ?? DEFAULT_FOOTER,
    sidebar: {
      ...DEFAULT_SIDEBAR,
      ...(typeof l.sidebar === "object" && l.sidebar ? l.sidebar as Record<string, unknown> : {}),
    },
    topBar: l.topBar ?? DEFAULT_TOPBAR,
  };
}

/**
 * Get tenant layout
 * GET /tenants/:id/layout
 */
export const getTenantLayout = async (req: Request, res: Response<IResponseFormat>) => {
  const { id } = req.params;

  const tenant = await tenantRepository.findById(id as string);
  if (!tenant) {
    throw new NotFoundError("Tenant not found");
  }

  const rawLayout = await tenantRepository.getLayout(id as string);
  const layout = rawLayout ? ensureCompleteLayout(rawLayout) : null;

  // Auto-generate footer when columns are empty (social links may legitimately be empty)
  if (layout && typeof layout === "object") {
    const l = layout as Record<string, unknown>;
    const footer = l.footer as Record<string, unknown> | undefined;
    if (footer) {
      const columns = footer.columns as unknown[] | undefined;
      const needsGenerate = !columns || columns.length === 0;

      if (needsGenerate) {
        try {
          const generatedFooter = await footerGeneratorService.generateFooter(id as string);
          if (!columns || columns.length === 0) footer.columns = generatedFooter.columns;
          if (!footer.description) footer.description = generatedFooter.description;
          if (!footer.contactInfo) footer.contactInfo = generatedFooter.contactInfo;
          if (!footer.copyright || footer.copyright === `© ${new Date().getFullYear()} All rights reserved.`) {
            footer.copyright = generatedFooter.copyright;
          }
          // Fire-and-forget persist
          tenantRepository.updateLayout(id as string, layout).catch((err) =>
            logger.warn("Failed to persist auto-generated footer", { tenantId: id, error: err.message })
          );
        } catch (err) {
          logger.warn("Failed to auto-generate footer", {
            tenantId: id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  sendSuccessResponse({
    res,
    data: layout,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant layout retrieved successfully",
  });
};

/**
 * Update tenant layout
 * PUT /tenants/:id/layout
 */
export const updateTenantLayout = async (req: Request, res: Response<IResponseFormat>) => {
  const { id } = req.params;
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  if (tenantId !== id) {
    throw new ForbiddenError("You can only update your own tenant's layout");
  }

  const tenant = await tenantRepository.findById(id as string);
  if (!tenant) {
    throw new NotFoundError("Tenant not found");
  }

  const layout = req.body;
  await tenantRepository.updateLayout(id as string, layout);

  sendSuccessResponse({
    res,
    data: layout,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant layout updated successfully",
  });
};

/**
 * Generate footer from tenant data
 * POST /tenants/:id/layout/generate-footer
 */
export const generateFooter = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }

  const footer = await footerGeneratorService.generateFooter(tenantId);

  sendSuccessResponse({
    res,
    data: footer,
    statusCode: HttpSuccessStatus.OK,
    message: "Footer generated successfully",
  });
};
