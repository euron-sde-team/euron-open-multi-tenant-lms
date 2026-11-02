import type {
  LayoutTemplate,
  TenantLayout,
  LayoutHeader,
  LayoutFooter,
  LayoutSidebar,
  LayoutTopBar,
  SidebarNavItem,
} from "@open-mtlms/shared";

// ============================================
// Default Layout Elements
// ============================================

// Dashboard header with search and profile
const dashboardHeader: LayoutHeader = {
  enabled: true,
  logo: "/logo.svg",
  logoAlt: "Logo",
  navItems: [], // Navigation handled by sidebar
  showDarkModeToggle: true,
  variant: "dashboard" as const,
  sticky: true,
  searchBar: {
    enabled: true,
    placeholder: "Search courses, instructors, topics...",
  },
  profileDropdown: {
    enabled: true,
    showAvatar: true,
    showName: true,
    menuItems: [
      { id: "profile", label: "Profile", href: "/profile", icon: "user" },
      { id: "my-learning", label: "My Learning", href: "/my-learning", icon: "graduation-cap" },
      { id: "settings", label: "Settings", href: "/profile", icon: "settings" },
      { id: "help", label: "Help Center", href: "/learn", icon: "help-circle" },
      { id: "logout", label: "Log out", href: "/", icon: "log-out", variant: "destructive" as const },
    ],
  },
  showNotifications: true,
};

// Landing page header with navigation
const landingHeader: LayoutHeader = {
  enabled: true,
  logo: "/logo.svg",
  logoAlt: "Logo",
  navItems: [
    { id: "1", label: "Home", href: "/" },
    { id: "2", label: "Features", href: "/" },
    { id: "3", label: "Pricing", href: "/" },
    { id: "4", label: "Contact", href: "/" },
  ],
  cta: {
    text: "Get Started",
    href: "/login",
    variant: "primary" as const,
  },
  showDarkModeToggle: true,
  variant: "minimal" as const,
  sticky: true,
};

// Comprehensive EdTech footer
const comprehensiveFooter: LayoutFooter = {
  enabled: true,
  logo: "/logo.svg",
  logoAlt: "Logo",
  description: "Empowering learners worldwide with cutting-edge education technology. Join millions of students achieving their goals.",
  columns: [
    {
      id: "company",
      title: "Company",
      links: [
        { label: "About Us", href: "/" },
        { label: "Careers", href: "/" },
        { label: "Press", href: "/" },
        { label: "Partners", href: "/" },
      ],
    },
    {
      id: "products",
      title: "Products",
      links: [
        { label: "All Courses", href: "/all-courses" },
        { label: "Books", href: "/books" },
        { label: "Certifications", href: "/" },
        { label: "For Business", href: "/" },
        { label: "For Universities", href: "/" },
      ],
    },
    {
      id: "resources",
      title: "Resources",
      links: [
        { label: "Help Center", href: "/" },
        { label: "Test Series", href: "/test-series" },
        { label: "Tutorials", href: "/" },
        { label: "Documentation", href: "/" },
        { label: "API", href: "/" },
      ],
    },
    {
      id: "legal",
      title: "More",
      links: [
        { label: "About Us", href: "/about" },
        { label: "Contact Us", href: "/contact" },
        { label: "FAQ", href: "/faq" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ],
    },
  ],
  socialLinks: [
    { platform: "twitter", url: "https://twitter.com", icon: "twitter" },
    { platform: "linkedin", url: "https://linkedin.com", icon: "linkedin" },
    { platform: "youtube", url: "https://youtube.com", icon: "youtube" },
    { platform: "instagram", url: "https://instagram.com", icon: "instagram" },
    { platform: "github", url: "https://github.com", icon: "github" },
  ],
  copyright: `© ${new Date().getFullYear()} Your Company. All rights reserved.`,
  bottomLinks: [
    { label: "Terms", href: "/" },
    { label: "Privacy", href: "/" },
    { label: "Cookies", href: "/" },
  ],
  variant: "comprehensive" as const,
  contactInfo: {
    email: "support@example.com",
    phone: "+1 (234) 567-890",
    address: "123 Education Ave, San Francisco, CA 94102",
  },
  trustBadges: [
    { id: "ssl", label: "SSL Secured", icon: "shield" },
    { id: "gdpr", label: "GDPR Compliant", icon: "check-circle" },
    { id: "iso", label: "ISO 27001", icon: "award" },
    { id: "soc2", label: "SOC 2 Type II", icon: "shield" },
  ],
  showLanguageSelector: true,
};

// Generic sidebar nav items, tenant-specific items come from the saved layout config
const defaultSidebarNavItems: SidebarNavItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/",
    icon: "home",
  },
];

const defaultSidebar: LayoutSidebar = {
  enabled: true,
  position: "left" as const,
  width: "280px",
  navItems: defaultSidebarNavItems,
  widgets: [],
  collapsible: true,
  defaultCollapsed: true,
  showLogo: true,
  logoSize: "md" as const,
};

const defaultTopBar: LayoutTopBar = {
  enabled: true,
  content: {
    type: "rich" as const,
    richContent: {
      message: "🎉 Special offer! Get 20% off all courses this week.",
      buttons: [
        {
          text: "Learn More",
          href: "/offers",
          variant: "primary" as const,
        },
      ],
    },
  },
  dismissible: true,
  backgroundColor: "221.2 83.2% 53.3%",
  textColor: "210 40% 98%",
};

// ============================================
// Layout Templates
// ============================================

export const layoutTemplates: LayoutTemplate[] = [
  {
    id: "full-width",
    name: "Full Width",
    description: "Clean layout with header and footer only, no sidebar. Perfect for landing pages and marketing sites.",
    thumbnail: "/templates/layout-full-width.png",
    preview: {
      hasHeader: true,
      hasFooter: true,
      hasSidebar: false,
      hasTopBar: false,
    },
    defaultConfig: {
      header: {
        ...landingHeader,
        variant: "minimal",
      },
      footer: {
        ...comprehensiveFooter,
        variant: "columns",
      },
      sidebar: {
        enabled: false,
        position: "left",
        width: "280px",
        navItems: [],
        widgets: [],
        collapsible: true,
        defaultCollapsed: true,
      },
      topBar: {
        enabled: false,
        content: { type: "text" },
        dismissible: true,
      },
    },
  },
  {
    id: "with-sidebar",
    name: "With Sidebar",
    description: "Full-featured layout with left sidebar navigation. Ideal for dashboards, LMS platforms, and apps.",
    thumbnail: "/templates/layout-with-sidebar.png",
    preview: {
      hasHeader: true,
      hasFooter: true,
      hasSidebar: true,
      hasTopBar: false,
    },
    defaultConfig: {
      header: {
        ...dashboardHeader,
      },
      footer: {
        ...comprehensiveFooter,
      },
      sidebar: {
        ...defaultSidebar,
        enabled: true,
      },
      topBar: {
        enabled: false,
        content: { type: "text" },
        dismissible: true,
      },
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Minimalist layout with just a header. Great for focused content and single-page applications.",
    thumbnail: "/templates/layout-minimal.png",
    preview: {
      hasHeader: true,
      hasFooter: false,
      hasSidebar: false,
      hasTopBar: false,
    },
    defaultConfig: {
      header: {
        ...landingHeader,
        variant: "transparent",
      },
      footer: {
        enabled: false,
        logo: "/logo.svg",
        logoAlt: "Logo",
        columns: [
          {
            id: "more",
            title: "More",
            links: [
              { label: "About Us", href: "/about" },
              { label: "Contact Us", href: "/contact" },
              { label: "FAQ", href: "/faq" },
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
            ],
          },
        ],
        copyright: "",
        variant: "simple",
      },
      sidebar: {
        enabled: false,
        position: "left",
        width: "280px",
        navItems: [],
        widgets: [],
        collapsible: true,
        defaultCollapsed: true,
      },
      topBar: {
        enabled: false,
        content: { type: "text" },
        dismissible: true,
      },
    },
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Full dashboard layout with sidebar, top bar, and minimal header. Perfect for admin panels and SaaS apps.",
    thumbnail: "/templates/layout-dashboard.png",
    preview: {
      hasHeader: true,
      hasFooter: true,
      hasSidebar: true,
      hasTopBar: true,
    },
    defaultConfig: {
      header: {
        ...dashboardHeader,
      },
      footer: {
        ...comprehensiveFooter,
      },
      sidebar: {
        ...defaultSidebar,
        enabled: true,
      },
      topBar: {
        ...defaultTopBar,
        enabled: true,
      },
    },
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get layout template by ID
 */
export function getLayoutTemplate(id: string): LayoutTemplate | undefined {
  return layoutTemplates.find((template) => template.id === id);
}

/**
 * Get all layout templates
 */
export function getAllLayoutTemplates(): LayoutTemplate[] {
  return layoutTemplates;
}

/**
 * Create a new tenant layout from a template
 */
export function createLayoutFromTemplate(
  templateId: string,
  tenantId: string
): Omit<TenantLayout, "id" | "createdAt" | "updatedAt"> | null {
  const template = getLayoutTemplate(templateId);
  if (!template) return null;

  return {
    tenantId,
    ...template.defaultConfig,
    templateId: template.id,
  };
}

/**
 * Get default tenant layout (with-sidebar template for LMS platforms)
 */
export function getDefaultTenantLayout(
  tenantId: string
): Omit<TenantLayout, "id" | "createdAt" | "updatedAt"> {
  // Use "with-sidebar" as default for LMS platforms
  const template = getLayoutTemplate("with-sidebar");
  if (!template) {
    // Fallback if template not found - include sidebar enabled
    return {
      tenantId,
      header: dashboardHeader,
      footer: comprehensiveFooter,
      sidebar: defaultSidebar,
      topBar: {
        enabled: false,
        content: { type: "text" },
        dismissible: true,
      },
    };
  }

  return {
    tenantId,
    ...template.defaultConfig,
    templateId: template.id,
  };
}
