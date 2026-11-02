import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PageConfig, SectionConfig, SectionType, ThemeConfig } from "@open-mtlms/shared";
import { generateId, createSectionConfig, reorderSections, cloneSection } from "@open-mtlms/shared";
import { sectionRegistry, defaultThemeConfig } from "@open-mtlms/ui-config";

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

interface EditorState {
  // Edit mode
  isEditMode: boolean;
  selectedSectionId: string | null;
  hoveredSectionId: string | null;
  
  // Page config
  pageConfig: PageConfig;
  
  // History for undo/redo
  history: HistoryState;
  
  // Clipboard
  clipboard: SectionConfig | null;
  
  // Panel state
  isSectionPanelOpen: boolean;
  isThemePanelOpen: boolean;
}

interface EditorActions {
  // Edit mode
  toggleEditMode: () => void;
  setEditMode: (enabled: boolean) => void;
  
  // Section selection
  selectSection: (sectionId: string | null) => void;
  hoverSection: (sectionId: string | null) => void;
  
  // Section CRUD
  addSection: (type: SectionType, variant: string, afterSectionId?: string) => void;
  updateSection: (sectionId: string, updates: Partial<SectionConfig>) => void;
  updateSectionContent: <T extends Record<string, unknown>>(sectionId: string, content: Partial<T>) => void;
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
  setThemePreset: (preset: ThemeConfig) => void;
  
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
  initializePageConfig: (config: PageConfig) => void; // Without history
  updatePageMeta: (updates: Partial<Pick<PageConfig, "title" | "slug" | "seo">>) => void;
  
  // Panel state
  toggleSectionPanel: () => void;
  toggleThemePanel: () => void;
  closePanels: () => void;
  openSectionPanel: () => void;
  openThemePanel: () => void;
}

export type EditorStore = EditorState & EditorActions;

export const useEditorStore = create<EditorStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isEditMode: false,
      selectedSectionId: null,
      hoveredSectionId: null,
      pageConfig: defaultPageConfig,
      history: {
        past: [],
        future: [],
      },
      clipboard: null,
      isSectionPanelOpen: false,
      isThemePanelOpen: false,

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
      addSection: (type, variant, afterSectionId) => {
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
        
        // Create new section
        const newSection = createSectionConfig(type, variant, registry.defaultContent, insertIndex);
        
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
        });
        
        // Log for development
        console.log("Section added:", JSON.stringify(newSection, null, 2));
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
        
        // Log for development
        const updatedSection = sections.find((s) => s.id === sectionId);
        console.log("Section content updated:", JSON.stringify(updatedSection, null, 2));
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
        
        console.log("Section deleted:", sectionId);
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
        
        console.log("Section duplicated:", JSON.stringify(clonedSection, null, 2));
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

      // History
      saveToHistory: () => {
        const { pageConfig, history } = get();
        set({
          history: {
            past: [...history.past.slice(-19), pageConfig], // Keep last 20 states
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
          console.log("Section copied to clipboard:", section.id);
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
        
        console.log("Section pasted:", JSON.stringify(clonedSection, null, 2));
      },

      // Import/Export
      exportConfig: () => {
        const { pageConfig } = get();
        const json = JSON.stringify(pageConfig, null, 2);
        console.log("Page config exported:", json);
        return json;
      },

      importConfig: (json) => {
        try {
          const config = JSON.parse(json) as PageConfig;
          const { saveToHistory } = get();
          saveToHistory();
          
          set({
            pageConfig: config,
          });
          
          console.log("Page config imported successfully");
          return true;
        } catch (error) {
          console.error("Failed to import config:", error);
          return false;
        }
      },

      // Page config
      setPageConfig: (config) => {
        const { saveToHistory } = get();
        saveToHistory();
        set({ pageConfig: config });
      },

      // Initialize page config without saving to history (for initial load)
      initializePageConfig: (config) => {
        set({ 
          pageConfig: config,
          selectedSectionId: null,
          hoveredSectionId: null,
          history: { past: [], future: [] },
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
        }));
      },

      toggleThemePanel: () => {
        set((state) => ({
          isThemePanelOpen: !state.isThemePanelOpen,
          isSectionPanelOpen: false,
        }));
      },

      closePanels: () => {
        set({
          isSectionPanelOpen: false,
          isThemePanelOpen: false,
        });
      },

      openSectionPanel: () => {
        set({
          isSectionPanelOpen: true,
          isThemePanelOpen: false,
        });
      },

      openThemePanel: () => {
        set({
          isThemePanelOpen: true,
          isSectionPanelOpen: false,
        });
      },
    }),
    {
      name: "lms-editor-store",
      partialize: (state) => ({
        pageConfig: state.pageConfig,
        isEditMode: state.isEditMode,
      }),
    }
  )
);
