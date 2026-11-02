import { create } from "zustand";
import { persist } from "zustand/middleware";

// Tenant settings configuration
interface TenantSettings {
  // Selected course page template ID for this tenant
  coursePageTemplateId: string | null;
  // Course page template theme overrides (if any)
  coursePageThemeOverrides: Record<string, unknown> | null;
  // Selected book page template ID for this tenant
  bookPageTemplateId: string | null;
  // Book page template theme overrides (if any)
  bookPageThemeOverrides: Record<string, unknown> | null;
}

// Settings per tenant ID
type TenantSettingsMap = Record<string, TenantSettings>;

interface TenantSettingsState {
  // Settings per tenant
  settingsByTenant: TenantSettingsMap;
}

interface TenantSettingsActions {
  // Get settings for a tenant
  getTenantSettings: (tenantId: string) => TenantSettings;
  
  // Course page template
  setCoursePageTemplate: (tenantId: string, templateId: string) => void;
  getCoursePageTemplateId: (tenantId: string) => string | null;
  
  // Course theme overrides
  setCoursePageThemeOverrides: (tenantId: string, overrides: Record<string, unknown> | null) => void;
  
  // Book page template
  setBookPageTemplate: (tenantId: string, templateId: string) => void;
  getBookPageTemplateId: (tenantId: string) => string | null;
  
  // Book theme overrides
  setBookPageThemeOverrides: (tenantId: string, overrides: Record<string, unknown> | null) => void;
  
  // Clear settings for a tenant
  clearTenantSettings: (tenantId: string) => void;
}

const defaultSettings: TenantSettings = {
  coursePageTemplateId: null,
  coursePageThemeOverrides: null,
  bookPageTemplateId: null,
  bookPageThemeOverrides: null,
};

export type TenantSettingsStore = TenantSettingsState & TenantSettingsActions;

export const useTenantSettingsStore = create<TenantSettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      settingsByTenant: {},

      // Get settings for a tenant (with defaults)
      getTenantSettings: (tenantId) => {
        const { settingsByTenant } = get();
        return settingsByTenant[tenantId] || defaultSettings;
      },

      // Set course page template for a tenant
      setCoursePageTemplate: (tenantId, templateId) => {
        const { settingsByTenant } = get();
        const currentSettings = settingsByTenant[tenantId] || defaultSettings;
        
        set({
          settingsByTenant: {
            ...settingsByTenant,
            [tenantId]: {
              ...currentSettings,
              coursePageTemplateId: templateId,
            },
          },
        });
      },

      // Get course page template ID for a tenant. Course pages use Modern template only.
      getCoursePageTemplateId: () => "modern",

      // Set theme overrides for course pages
      setCoursePageThemeOverrides: (tenantId, overrides) => {
        const { settingsByTenant } = get();
        const currentSettings = settingsByTenant[tenantId] || defaultSettings;
        
        set({
          settingsByTenant: {
            ...settingsByTenant,
            [tenantId]: {
              ...currentSettings,
              coursePageThemeOverrides: overrides,
            },
          },
        });
      },

      // Set book page template for a tenant
      setBookPageTemplate: (tenantId, templateId) => {
        const { settingsByTenant } = get();
        const currentSettings = settingsByTenant[tenantId] || defaultSettings;
        
        set({
          settingsByTenant: {
            ...settingsByTenant,
            [tenantId]: {
              ...currentSettings,
              bookPageTemplateId: templateId,
            },
          },
        });
      },

      // Get book page template ID for a tenant
      getBookPageTemplateId: (tenantId) => {
        const { settingsByTenant } = get();
        return settingsByTenant[tenantId]?.bookPageTemplateId || null;
      },

      // Set theme overrides for book pages
      setBookPageThemeOverrides: (tenantId, overrides) => {
        const { settingsByTenant } = get();
        const currentSettings = settingsByTenant[tenantId] || defaultSettings;
        
        set({
          settingsByTenant: {
            ...settingsByTenant,
            [tenantId]: {
              ...currentSettings,
              bookPageThemeOverrides: overrides,
            },
          },
        });
      },

      // Clear settings for a tenant
      clearTenantSettings: (tenantId) => {
        const { settingsByTenant } = get();
        const newSettings = { ...settingsByTenant };
        delete newSettings[tenantId];
        
        set({ settingsByTenant: newSettings });
      },
    }),
    {
      name: "lms-admin-tenant-settings",
    }
  )
);
