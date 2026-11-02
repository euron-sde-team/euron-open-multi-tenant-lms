import type {
  LayoutFooter,
  LayoutHeader,
  LayoutSidebar,
  LayoutTopBar,
  PageConfig,
  PageLayoutOverrides,
  SectionConfig,
  SectionType,
  TenantLayout,
  ThemeConfig,
} from "@open-mtlms/shared";
import {
  cloneSection,
  createSectionConfig,
  generateId,
  reorderSections,
} from "@open-mtlms/shared";
import { defaultThemeConfig, getLayoutTemplate, sectionRegistry } from "@open-mtlms/ui-config";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Clean up old localStorage data that may have exceeded quota
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("lms-admin-editor-store");
    if (stored) {
      const parsed = JSON.parse(stored);
      // If old data has pageConfig, clear it to prevent quota issues
      if (parsed?.state?.pageConfig) {
        localStorage.removeItem("lms-admin-editor-store");
        console.log("Cleared old editor store data to prevent quota issues");
      }
    }
    // Also clear old mock pages data
    localStorage.removeItem("lms_mock_pages");
  } catch {
    // If parsing fails, just clear everything
    localStorage.removeItem("lms-admin-editor-store");
    localStorage.removeItem("lms_mock_pages");
  }
}

// Default page configuration
const defaultPageConfig: PageConfig = {
  id: generateId(),
  tenantId: "demo-tenant",
  slug: "home",
  title: "Welcome to Our Platform",
  sections: [
    createSectionConfig("hero", "centered", sectionRegistry.hero.defaultContent, 0),
    createSectionConfig("features-grid", "3-col", sectionRegistry["features-grid"].defaultContent, 1),
    createSectionConfig("testimonials-grid", "uniform", sectionRegistry["testimonials-grid"].defaultContent, 2),
    createSectionConfig("pricing-table", "cards", sectionRegistry["pricing-table"].defaultContent, 3),
    createSectionConfig("faq-accordion", "simple", sectionRegistry["faq-accordion"].defaultContent, 4),
    createSectionConfig("cta-banner", "gradient", sectionRegistry["cta-banner"].defaultContent, 5),
  ],
  theme: defaultThemeConfig,
  seo: {
    title: "Welcome to Our Platform",
    description: "Create and sell digital products with our powerful platform",
  },
  isPublished: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface HistoryState {
  past: PageConfig[];
  future: PageConfig[];
}

export type PreviewDevice = "iphoneSE" | "iphone14" | "ipad" | "ipadPro" | "desktop";

interface EditorState {
  // Edit mode
  isEditMode: boolean;
  selectedSectionId: string | null;
  hoveredSectionId: string | null;
  
  // Page config
  pageConfig: PageConfig;
  
  // Global theme (from homepage, used for non-homepage pages)
  globalTheme: ThemeConfig | null;
  
  // Tenant Layout (global across all pages)
  tenantLayout: TenantLayout | null;
  
  // History for undo/redo
  history: HistoryState;
  
  // Clipboard
  clipboard: SectionConfig | null;
  
  // Panel state
  isSectionPanelOpen: boolean;
  isThemePanelOpen: boolean;
  isContentPanelOpen: boolean;
  /** When opening section panel from divider +, this overrides selectedSectionId for insert position */
  addSectionContext: { afterSectionId?: string } | null;
  
  // Device preview
  previewDevice: PreviewDevice;
}

interface EditorActions {
  // Edit mode
  toggleEditMode: () => void;
  setEditMode: (enabled: boolean) => void;
  
  // Section selection
  selectSection: (sectionId: string | null) => void;
  hoverSection: (sectionId: string | null) => void;
  
  // Section CRUD
  addSection: (type: SectionType, variant: string, afterSectionId?: string, contentOverride?: Record<string, unknown>) => void;
  updateSection: (sectionId: string, updates: Partial<SectionConfig>) => void;
  updateSectionContent: <T extends Record<string, unknown>>(sectionId: string, content: Partial<T>) => void;
  /** Same as updateSectionContent but without saving to history, for batch AI generation */
  updateSectionContentSilent: <T extends Record<string, unknown>>(sectionId: string, content: Partial<T>) => void;
  deleteSection: (sectionId: string) => void;
  duplicateSection: (sectionId: string) => void;
  
  // Section visibility
  toggleSectionVisibility: (sectionId: string) => void;
  
  // Section reordering
  moveSection: (sectionId: string, direction: "up" | "down") => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  
  // Variant switching
  changeSectionVariant: (sectionId: string, variant: string) => void;
  changeSectionType: (sectionId: string, newType: SectionType, newVariant: string) => void;
  
  // Theme
  updateTheme: (theme: Partial<ThemeConfig>) => void;
  updateGlobalTheme: (theme: Partial<ThemeConfig>) => void;
  setThemePreset: (preset: ThemeConfig) => void;
  setThemePresetGlobal: (preset: ThemeConfig) => void;
  setGlobalTheme: (theme: ThemeConfig | null) => void;
  
  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  
  // Clipboard
  copySection: (sectionId: string) => void;
  pasteSection: (afterSectionId?: string) => void;
  
  // Import/Export
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
  
  // Page config
  setPageConfig: (config: PageConfig) => void;
  initializePageConfig: (config: PageConfig) => void;
  updatePageMeta: (updates: Partial<Pick<PageConfig, "title" | "slug" | "seo">>) => void;
  resetToDefault: () => void;
  
  // Panel state
  toggleSectionPanel: () => void;
  openSectionPanel: (afterSectionId?: string) => void;
  toggleThemePanel: () => void;
  toggleContentPanel: () => void;
  closePanels: () => void;
  
  // Layout actions
  setTenantLayout: (layout: TenantLayout) => void;
  initializeTenantLayout: (layout: TenantLayout | null) => void;
  updateLayout: (updates: Partial<Omit<TenantLayout, "id" | "tenantId" | "createdAt" | "updatedAt">>) => void;
  updateLayoutHeader: (updates: Partial<LayoutHeader>) => void;
  updateLayoutFooter: (updates: Partial<LayoutFooter>) => void;
  updateLayoutSidebar: (updates: Partial<LayoutSidebar>) => void;
  updateLayoutTopBar: (updates: Partial<LayoutTopBar>) => void;
  setLayoutTemplate: (templateId: string) => void;
  
  // Page layout overrides
  updatePageLayoutOverrides: (overrides: PageLayoutOverrides) => void;
  toggleLayoutElementVisibility: (element: keyof PageLayoutOverrides) => void;
  
  // Device preview
  setPreviewDevice: (device: PreviewDevice) => void;
}

export type EditorStore = EditorState & EditorActions;

export const useEditorStore = create<EditorStore>()(
  persist(
    (set, get) => ({
      // Initial state - Edit mode is ON by default in admin
      isEditMode: true,
      selectedSectionId: null,
      hoveredSectionId: null,
      pageConfig: defaultPageConfig,
      globalTheme: null,
      tenantLayout: null,
      history: {
        past: [],
        future: [],
      },
      clipboard: null,
      isSectionPanelOpen: false,
      isThemePanelOpen: false,
      isContentPanelOpen: false,
      addSectionContext: null,
      previewDevice: "desktop" as PreviewDevice,

      // Edit mode actions
      toggleEditMode: () => {
        set((state) => ({ isEditMode: !state.isEditMode }));
      },
      
      setEditMode: (enabled) => {
        set({ isEditMode: enabled });
      },

      // Section selection
      selectSection: (sectionId) => {
        set({ selectedSectionId: sectionId });
      },
      
      hoverSection: (sectionId) => {
        set({ hoveredSectionId: sectionId });
      },

      // Section CRUD
      addSection: (type, variant, afterSectionId, contentOverride) => {
        const { pageConfig, saveToHistory } = get();
        saveToHistory();
        
        const registry = sectionRegistry[type as keyof typeof sectionRegistry];
        if (!registry) return; // header/footer deprecated - use layout
        const sections = [...pageConfig.sections];
        
        // Find insert position: undefined = insert at top (index 0)
        let insertIndex = 0;
        if (afterSectionId) {
          const afterIndex = sections.findIndex((s) => s.id === afterSectionId);
          if (afterIndex !== -1) {
            insertIndex = afterIndex + 1;
          } else {
            insertIndex = sections.length;
          }
        }
        
        const baseContent = registry.defaultContent as Record<string, unknown>;
        const content = contentOverride
          ? { ...baseContent, ...contentOverride }
          : baseContent;
        
        // Create new section
        const newSection = createSectionConfig(type, variant, content, insertIndex);
        
        // Insert and reorder
        sections.splice(insertIndex, 0, newSection);
        const reorderedSections = sections.map((s, i) => ({ ...s, order: i }));
        
        set({
          pageConfig: {
            ...pageConfig,
            sections: reorderedSections,
            updatedAt: new Date().toISOString(),
          },
          selectedSectionId: newSection.id,
          isSectionPanelOpen: false,
          addSectionContext: null,
        });
      },

      updateSection: (sectionId, updates) => {
        const { pageConfig, saveToHistory } = get();
        saveToHistory();

        const sections = pageConfig.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                ...updates,
                ...(updates.settings !== undefined && {
                  settings: {
                    ...(section.settings ?? {}),
                    ...updates.settings,
                  },
                }),
                updatedAt: new Date().toISOString(),
              }
            : section
        );

        set({
          pageConfig: {
            ...pageConfig,
            sections,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      updateSectionContent: <T extends Record<string, unknown>>(sectionId: string, content: Partial<T>) => {
        const { pageConfig, saveToHistory } = get();
        saveToHistory();

        const sections = pageConfig.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                content: { ...(section.content as Record<string, unknown>), ...content },
                updatedAt: new Date().toISOString(),
              }
            : section
        );

        set({
          pageConfig: {
            ...pageConfig,
            sections,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      updateSectionContentSilent: <T extends Record<string, unknown>>(sectionId: string, content: Partial<T>) => {
        const { pageConfig } = get();

        const sections = pageConfig.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                content: { ...(section.content as Record<string, unknown>), ...content },
                updatedAt: new Date().toISOString(),
              }
            : section
        );

        set({
          pageConfig: {
            ...pageConfig,
            sections,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      deleteSection: (sectionId) => {
        const { pageConfig, saveToHistory, selectedSectionId } = get();
        saveToHistory();
        
        const sections = pageConfig.sections
          .filter((section) => section.id !== sectionId)
          .map((section, index) => ({ ...section, order: index }));
        
        set({
          pageConfig: {
            ...pageConfig,
            sections,
            updatedAt: new Date().toISOString(),
          },
          selectedSectionId: selectedSectionId === sectionId ? null : selectedSectionId,
        });
      },

      duplicateSection: (sectionId) => {
        const { pageConfig, saveToHistory } = get();
        saveToHistory();
        
        const sectionIndex = pageConfig.sections.findIndex((s) => s.id === sectionId);
        if (sectionIndex === -1) return;
        
        const originalSection = pageConfig.sections[sectionIndex];
        const clonedSection = cloneSection(originalSection);
        
        const sections = [...pageConfig.sections];
        sections.splice(sectionIndex + 1, 0, clonedSection);
        const reorderedSections = sections.map((s, i) => ({ ...s, order: i }));
        
        set({
          pageConfig: {
            ...pageConfig,
            sections: reorderedSections,
            updatedAt: new Date().toISOString(),
          },
          selectedSectionId: clonedSection.id,
        });
      },

      // Section visibility
      toggleSectionVisibility: (sectionId) => {
        const { pageConfig, saveToHistory } = get();
        saveToHistory();
        
        const sections = pageConfig.sections.map((section) =>
          section.id === sectionId
            ? { ...section, visible: !section.visible, updatedAt: new Date().toISOString() }
            : section
        );
        
        set({
          pageConfig: {
            ...pageConfig,
            sections,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      // Section reordering
      moveSection: (sectionId, direction) => {
        const { pageConfig, saveToHistory } = get();
        const sections = [...pageConfig.sections];
        const currentIndex = sections.findIndex((s) => s.id === sectionId);
        
        if (currentIndex === -1) return;
        
        const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= sections.length) return;
        
        saveToHistory();
        const reorderedSections = reorderSections(sections, currentIndex, newIndex);
        
        set({
          pageConfig: {
            ...pageConfig,
            sections: reorderedSections,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      reorderSections: (fromIndex, toIndex) => {
        const { pageConfig, saveToHistory } = get();
        saveToHistory();
        
        const reorderedSections = reorderSections(pageConfig.sections, fromIndex, toIndex);
        
        set({
          pageConfig: {
            ...pageConfig,
            sections: reorderedSections,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      // Variant switching
      changeSectionVariant: (sectionId, variant) => {
        const { pageConfig, saveToHistory } = get();
        saveToHistory();
        
        const sections = pageConfig.sections.map((section) =>
          section.id === sectionId
            ? { ...section, variant, updatedAt: new Date().toISOString() }
            : section
        );
        
        set({
          pageConfig: {
            ...pageConfig,
            sections,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      changeSectionType: (sectionId, newType, newVariant) => {
        const { pageConfig, saveToHistory } = get();
        saveToHistory();

        const registry = sectionRegistry[newType as keyof typeof sectionRegistry];
        if (!registry) return; // header/footer deprecated - use layout
        const sections = pageConfig.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                type: newType,
                variant: newVariant,
                content: registry.defaultContent as Record<string, unknown>,
                updatedAt: new Date().toISOString(),
              }
            : section
        );

        set({
          pageConfig: {
            ...pageConfig,
            sections,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      // Theme
      updateTheme: (themeUpdates) => {
        const { pageConfig, saveToHistory } = get();
        saveToHistory();
        
        set({
          pageConfig: {
            ...pageConfig,
            theme: { ...pageConfig.theme, ...themeUpdates },
            updatedAt: new Date().toISOString(),
          },
        });
      },

      setThemePreset: (preset) => {
        const { pageConfig, saveToHistory } = get();
        saveToHistory();

        // When theme is applied, overwrite all custom styling (textStyles, section backgrounds) so theme takes priority
        const sectionsWithThemePriority = pageConfig.sections.map((section) => {
          const content = section.content as Record<string, unknown>;
          const settings = section.settings ?? {};
          const { textStyles: _textStyles, ...restContent } =
            content && typeof content === "object" ? content : { textStyles: undefined };
          const { backgroundColor: _bg, backgroundColorDark: _bgDark, ...restSettings } = settings;
          return {
            ...section,
            content: content && typeof content === "object" ? restContent : section.content,
            settings: restSettings,
            updatedAt: new Date().toISOString(),
          };
        });

        set({
          pageConfig: {
            ...pageConfig,
            theme: preset,
            sections: sectionsWithThemePriority,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      updateGlobalTheme: (themeUpdates) => {
        const { globalTheme } = get();
        const base = globalTheme ?? defaultThemeConfig;
        set({
          globalTheme: { ...base, ...themeUpdates } as ThemeConfig,
        });
      },

      setThemePresetGlobal: (preset) => {
        set({ globalTheme: preset });
      },

      setGlobalTheme: (theme) => {
        set({ globalTheme: theme });
      },

      // History
      saveToHistory: () => {
        const { pageConfig, history } = get();
        set({
          history: {
            past: [...history.past.slice(-19), pageConfig],
            future: [],
          },
        });
      },

      undo: () => {
        const { history, pageConfig } = get();
        if (history.past.length === 0) return;
        
        const previous = history.past[history.past.length - 1];
        const newPast = history.past.slice(0, -1);
        
        set({
          pageConfig: previous,
          history: {
            past: newPast,
            future: [pageConfig, ...history.future],
          },
        });
      },

      redo: () => {
        const { history, pageConfig } = get();
        if (history.future.length === 0) return;
        
        const next = history.future[0];
        const newFuture = history.future.slice(1);
        
        set({
          pageConfig: next,
          history: {
            past: [...history.past, pageConfig],
            future: newFuture,
          },
        });
      },

      // Clipboard
      copySection: (sectionId) => {
        const { pageConfig } = get();
        const section = pageConfig.sections.find((s) => s.id === sectionId);
        if (section) {
          set({ clipboard: section });
        }
      },

      pasteSection: (afterSectionId) => {
        const { clipboard, pageConfig, saveToHistory } = get();
        if (!clipboard) return;
        
        saveToHistory();
        
        const clonedSection = cloneSection(clipboard);
        const sections = [...pageConfig.sections];
        
        let insertIndex = sections.length;
        if (afterSectionId) {
          const afterIndex = sections.findIndex((s) => s.id === afterSectionId);
          if (afterIndex !== -1) {
            insertIndex = afterIndex + 1;
          }
        }
        
        sections.splice(insertIndex, 0, clonedSection);
        const reorderedSections = sections.map((s, i) => ({ ...s, order: i }));
        
        set({
          pageConfig: {
            ...pageConfig,
            sections: reorderedSections,
            updatedAt: new Date().toISOString(),
          },
          selectedSectionId: clonedSection.id,
        });
      },

      // Import/Export
      exportConfig: () => {
        const { pageConfig } = get();
        return JSON.stringify(pageConfig, null, 2);
      },

      importConfig: (json) => {
        try {
          const config = JSON.parse(json) as PageConfig;
          const { saveToHistory } = get();
          saveToHistory();
          
          set({
            pageConfig: config,
          });
          
          return true;
        } catch {
          return false;
        }
      },

      // Page config
      setPageConfig: (config) => {
        const { saveToHistory } = get();
        saveToHistory();
        set({ pageConfig: config });
      },

      // Initialize page config without adding to history (for loading pages)
      initializePageConfig: (config) => {
        set({
          pageConfig: config,
          history: { past: [], future: [] },
          selectedSectionId: null,
          hoveredSectionId: null,
          isSectionPanelOpen: false,
          isThemePanelOpen: false,
        });
      },

      // Reset to default page config
      resetToDefault: () => {
        set({
          pageConfig: defaultPageConfig,
          history: { past: [], future: [] },
          selectedSectionId: null,
          hoveredSectionId: null,
          isSectionPanelOpen: false,
          isThemePanelOpen: false,
        });
      },

      updatePageMeta: (updates) => {
        const { pageConfig, saveToHistory } = get();
        saveToHistory();
        
        set({
          pageConfig: {
            ...pageConfig,
            ...updates,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      // Panel state
      toggleSectionPanel: () => {
        set((state) => ({
          isSectionPanelOpen: !state.isSectionPanelOpen,
          isThemePanelOpen: false,
          isContentPanelOpen: false,
          addSectionContext: null,
        }));
      },

      openSectionPanel: (afterSectionId) => {
        set({
          isSectionPanelOpen: true,
          isThemePanelOpen: false,
          isContentPanelOpen: false,
          addSectionContext: afterSectionId != null ? { afterSectionId } : null,
        });
      },

      toggleThemePanel: () => {
        set((state) => ({
          isThemePanelOpen: !state.isThemePanelOpen,
          isSectionPanelOpen: false,
          isContentPanelOpen: false,
        }));
      },

      toggleContentPanel: () => {
        set((state) => ({
          isContentPanelOpen: !state.isContentPanelOpen,
          isSectionPanelOpen: false,
          isThemePanelOpen: false,
          addSectionContext: null,
        }));
      },

      closePanels: () => {
        set({
          isSectionPanelOpen: false,
          isThemePanelOpen: false,
          isContentPanelOpen: false,
          addSectionContext: null,
        });
      },

      // Layout actions
      setTenantLayout: (layout) => {
        const { saveToHistory } = get();
        saveToHistory();
        set({ tenantLayout: layout });
      },

      initializeTenantLayout: (layout) => {
        set({ tenantLayout: layout });
      },

      updateLayout: (updates) => {
        const { tenantLayout, saveToHistory } = get();
        if (!tenantLayout) return;
        
        saveToHistory();
        set({
          tenantLayout: {
            ...tenantLayout,
            ...updates,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      updateLayoutHeader: (updates) => {
        const { tenantLayout, saveToHistory } = get();
        if (!tenantLayout) return;
        
        saveToHistory();
        set({
          tenantLayout: {
            ...tenantLayout,
            header: { ...tenantLayout.header, ...updates },
            updatedAt: new Date().toISOString(),
          },
        });
      },

      updateLayoutFooter: (updates) => {
        const { tenantLayout, saveToHistory } = get();
        if (!tenantLayout) return;
        
        saveToHistory();
        set({
          tenantLayout: {
            ...tenantLayout,
            footer: { ...tenantLayout.footer, ...updates },
            updatedAt: new Date().toISOString(),
          },
        });
      },

      updateLayoutSidebar: (updates) => {
        const { tenantLayout, saveToHistory } = get();
        if (!tenantLayout) return;
        
        saveToHistory();
        set({
          tenantLayout: {
            ...tenantLayout,
            sidebar: { ...tenantLayout.sidebar, ...updates },
            updatedAt: new Date().toISOString(),
          },
        });
      },

      updateLayoutTopBar: (updates) => {
        const { tenantLayout, saveToHistory } = get();
        if (!tenantLayout) return;
        
        saveToHistory();
        set({
          tenantLayout: {
            ...tenantLayout,
            topBar: { ...tenantLayout.topBar, ...updates },
            updatedAt: new Date().toISOString(),
          },
        });
      },

      setLayoutTemplate: (templateId) => {
        const { tenantLayout, saveToHistory } = get();
        if (!tenantLayout) return;
        
        const template = getLayoutTemplate(templateId);
        if (!template) return;
        
        saveToHistory();
        set({
          tenantLayout: {
            ...tenantLayout,
            ...template.defaultConfig,
            templateId: template.id,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      // Page layout overrides
      updatePageLayoutOverrides: (overrides) => {
        const { pageConfig, saveToHistory } = get();
        saveToHistory();
        
        set({
          pageConfig: {
            ...pageConfig,
            layoutOverrides: {
              ...pageConfig.layoutOverrides,
              ...overrides,
            },
            updatedAt: new Date().toISOString(),
          },
        });
      },

      toggleLayoutElementVisibility: (element) => {
        const { pageConfig, saveToHistory } = get();
        saveToHistory();
        
        const currentValue = pageConfig.layoutOverrides?.[element] ?? false;
        
        set({
          pageConfig: {
            ...pageConfig,
            layoutOverrides: {
              ...pageConfig.layoutOverrides,
              [element]: !currentValue,
            },
            updatedAt: new Date().toISOString(),
          },
        });
      },

      // Device preview
      setPreviewDevice: (device) => {
        set({ previewDevice: device });
      },
    }),
    {
      name: "lms-admin-editor-store",
      // Only persist UI preferences, NOT page data (page data comes from backend)
      partialize: (state) => ({
        isEditMode: state.isEditMode,
        previewDevice: state.previewDevice,
      }),
    }
  )
);
