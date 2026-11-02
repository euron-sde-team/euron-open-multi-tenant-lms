import type { TenantLayout } from "@open-mtlms/shared";

/**
 * Empty layout - no fallback.
 * Everything is rendered from the JSON payload.
 * If no layout is provided in the page data, nothing will be shown.
 */
export const emptyLayout: TenantLayout = {
  id: "empty",
  tenantId: "empty",
  
  header: {
    enabled: false,
    logo: "",
    logoAlt: "",
    navItems: [],
    showDarkModeToggle: false,
    variant: "minimal",
    sticky: false,
  },
  
  footer: {
    enabled: false,
    logo: "",
    logoAlt: "",
    description: "",
    columns: [],
    socialLinks: [],
    copyright: "",
    variant: "simple",
  },
  
  sidebar: {
    enabled: false,
    position: "left",
    width: "280px",
    collapsible: true,
    defaultCollapsed: true,
    showLogo: false,
    logoSize: "md",
    navItems: [],
    widgets: [],
  },
  
  topBar: {
    enabled: false,
    content: {
      type: "text",
      text: "",
    },
    dismissible: false,
  },
  
  createdAt: "",
  updatedAt: "",
};
