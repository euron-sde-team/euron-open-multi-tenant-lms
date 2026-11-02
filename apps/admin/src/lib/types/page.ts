import type { PageConfig, SectionConfig, SEOConfig, ThemeConfig, TenantLayout } from "@open-mtlms/shared";

// Key used to embed layout in first section's settings
const LAYOUT_SETTINGS_KEY = "__tenantLayout__";

export type PageRenderMode = "SECTIONS" | "CUSTOM_CODE";
export type CustomCodeKind = "SANITIZED_INLINE" | "SANDBOXED_IFRAME";

/** One hosted image a tenant uploaded for a custom-code page (image library). */
export interface CustomPageImage {
  url: string;
  name?: string;
  uploadedAt: string;
}

/** Shape stored in tenant_pages.custom_assets for custom-code pages. */
export interface CustomPageAssets {
  images?: CustomPageImage[];
}

// Page from backend (with database fields)
export interface Page {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  sections: SectionConfig[];
  theme: ThemeConfig;
  seo: SEOConfig;
  isPublished: boolean;
  metadata?: Record<string, unknown>; // Extensible metadata for additional data (e.g., LMS config)
  createdAt: string;
  updatedAt: string;
  // Custom-code pages
  renderMode?: PageRenderMode;
  customCodeKind?: CustomCodeKind | null;
  /** Published HTML served to visitors. */
  customHtml?: string | null;
  /** Work-in-progress HTML the editor edits. */
  customHtmlDraft?: string | null;
  /** Hosted images uploaded for this page (image library). */
  customAssets?: CustomPageAssets | null;
  moderationStatus?: "ACTIVE" | "BLOCKED";
}

// Request to create a new page
export interface CreatePageRequest {
  tenantId: string;
  slug: string;
  title: string;
  sections: SectionConfig[];
  theme: ThemeConfig;
  seo: SEOConfig;
  isPublished?: boolean;
}

// Request to update an existing page
// NOTE: slug is intentionally excluded - routes are fixed and cannot be changed
export interface UpdatePageRequest {
  title?: string;
  sections?: SectionConfig[];
  theme?: ThemeConfig;
  seo?: SEOConfig;
  isPublished?: boolean;
  metadata?: Record<string, unknown>;
  renderMode?: PageRenderMode;
  customCodeKind?: CustomCodeKind | null;
  /** Editor content, saved to the draft copy; served only after publish. */
  customHtmlDraft?: string | null;
  /** Hosted images uploaded for this page (image library). */
  customAssets?: CustomPageAssets | null;
}

// Response when listing pages
export interface PagesListResponse {
  pages: Page[];
  total: number;
  page: number;
  limit: number;
}

// Extract layout from first section's settings (stored as __tenantLayout__ key)
export function extractLayoutFromSections(sections: SectionConfig[]): TenantLayout | undefined {
  if (sections.length === 0) return undefined;

  const firstSection = sections[0];
  const settings = firstSection.settings as Record<string, unknown>;

  if (settings && settings[LAYOUT_SETTINGS_KEY]) {
    return settings[LAYOUT_SETTINGS_KEY] as TenantLayout;
  }
  return undefined;
}

// Embed layout into first section's settings
export function embedLayoutInSections(sections: SectionConfig[], layout: TenantLayout): SectionConfig[] {
  if (sections.length === 0) return sections;

  const result = [...sections];
  const firstSection = { ...result[0] };
  const newSettings = {
    ...firstSection.settings,
    [LAYOUT_SETTINGS_KEY]: layout,
  } as SectionConfig["settings"] & Record<string, unknown>;
  firstSection.settings = newSettings as SectionConfig["settings"];
  result[0] = firstSection;

  return result;
}

// Remove layout from first section's settings (for clean sections in editor)
function cleanLayoutFromSections(sections: SectionConfig[]): SectionConfig[] {
  if (sections.length === 0) return sections;

  const result = [...sections];
  const firstSection = { ...result[0] };
  const settings = { ...firstSection.settings } as Record<string, unknown>;
  delete settings[LAYOUT_SETTINGS_KEY];
  firstSection.settings = settings as SectionConfig["settings"];
  result[0] = firstSection;

  return result;
}

// Convert Page to PageConfig for editor
export function pageToPageConfig(page: Page): PageConfig {
  // Extract layout from first section's settings
  const layout = extractLayoutFromSections(page.sections);
  // Clean layout from sections for editor (so it's not in settings)
  const cleanSections = cleanLayoutFromSections(page.sections);
  // Normalize settings for backward compat (ensure settings is never undefined)
  const normalizedSections = cleanSections.map((s) => ({
    ...s,
    settings: s.settings && typeof s.settings === "object" ? s.settings : {},
  }));

  return {
    id: page.id,
    tenantId: page.tenantId,
    slug: page.slug,
    title: page.title,
    sections: normalizedSections,
    theme: page.theme,
    seo: page.seo,
    isPublished: page.isPublished,
    layout,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

// Convert PageConfig to CreatePageRequest
// Embeds layout in first section's settings
export function pageConfigToCreateRequest(
  config: PageConfig,
  tenantId: string
): CreatePageRequest {
  let sections = [...config.sections];
  if (config.layout && sections.length > 0) {
    sections = embedLayoutInSections(sections, config.layout);
  }

  return {
    tenantId,
    slug: config.slug,
    title: config.title,
    sections,
    theme: config.theme,
    seo: config.seo,
    isPublished: config.isPublished,
  };
}

// Convert PageConfig to UpdatePageRequest
// NOTE: slug is NOT included - routes are fixed and cannot be changed by users
// Embeds layout in first section's settings
export function pageConfigToUpdateRequest(config: PageConfig): UpdatePageRequest {
  let sections = [...config.sections];
  if (config.layout && sections.length > 0) {
    sections = embedLayoutInSections(sections, config.layout);
  }

  return {
    title: config.title,
    sections,
    theme: config.theme,
    seo: { ...config.seo, title: config.title },
    isPublished: config.isPublished,
  };
}
