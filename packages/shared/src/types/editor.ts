// Editor Types - State management for the page builder

import type { SectionConfig, SectionType } from "./section";
import type { PageConfig } from "./page";
import type { ThemeConfig } from "./theme";

export interface EditorState {
  isEditMode: boolean;
  selectedSectionId: string | null;
  hoveredSectionId: string | null;
  isDragging: boolean;
  draggedSectionId: string | null;
  history: HistoryState;
  clipboard: SectionConfig | null;
}

export interface HistoryState {
  past: PageConfig[];
  present: PageConfig;
  future: PageConfig[];
  canUndo: boolean;
  canRedo: boolean;
}

export interface EditorActions {
  // Edit mode
  toggleEditMode: () => void;
  setEditMode: (enabled: boolean) => void;

  // Section selection
  selectSection: (sectionId: string | null) => void;
  hoverSection: (sectionId: string | null) => void;

  // Section CRUD
  addSection: (type: SectionType, variant: string, afterSectionId?: string) => void;
  updateSection: (sectionId: string, updates: Partial<SectionConfig>) => void;
  updateSectionContent: <T extends Record<string, unknown>>(
    sectionId: string,
    content: Partial<T>
  ) => void;
  deleteSection: (sectionId: string) => void;
  duplicateSection: (sectionId: string) => void;

  // Section visibility
  toggleSectionVisibility: (sectionId: string) => void;
  showSection: (sectionId: string) => void;
  hideSection: (sectionId: string) => void;

  // Section reordering
  moveSection: (sectionId: string, direction: "up" | "down") => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;

  // Variant switching
  changeSectionVariant: (sectionId: string, variant: string) => void;

  // Theme
  updateTheme: (theme: Partial<ThemeConfig>) => void;
  setThemePreset: (presetId: string) => void;

  // History
  undo: () => void;
  redo: () => void;

  // Clipboard
  copySection: (sectionId: string) => void;
  pasteSection: (afterSectionId?: string) => void;

  // Import/Export
  exportConfig: () => string;
  importConfig: (json: string) => boolean;

  // Page config
  setPageConfig: (config: PageConfig) => void;
  updatePageMeta: (updates: Partial<Pick<PageConfig, "title" | "slug" | "seo">>) => void;
}

export type EditorStore = EditorState & EditorActions & { pageConfig: PageConfig };

// Drag and drop types
export interface DragItem {
  type: "section" | "new-section";
  sectionId?: string;
  sectionType?: SectionType;
  variant?: string;
}

export interface DropResult {
  targetIndex: number;
}

// Section panel types
export interface SectionPanelItem {
  type: SectionType;
  name: string;
  description: string;
  icon: string;
  variants: {
    id: string;
    name: string;
    thumbnail?: string;
  }[];
}

export interface SectionPanelCategory {
  id: string;
  name: string;
  sections: SectionPanelItem[];
}
