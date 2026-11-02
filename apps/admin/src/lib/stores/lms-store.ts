import type {
  LMSCourseData,
  LMSSection,
  LMSLesson,
  LMSResource,
  LMSSettings,
  LMSTemplateId,
  LMSVideoConfig,
} from "@open-mtlms/shared";
import {
  DEFAULT_LMS_SETTINGS,
  createLMSSection,
  createLMSLesson,
  createLMSResource,
} from "@open-mtlms/shared";
import { create } from "zustand";

// LMS Section types for inline editing
export type LMSSectionType =
  | "video"
  | "overview"
  | "resources"
  | "qna"
  | "ratings"
  | "sidebar"
  | "settings";

// History state for undo/redo
interface HistoryState {
  past: LMSCourseData[];
  future: LMSCourseData[];
}

// LMS Store State
interface LMSStoreState {
  // True once store is ready (no persist: we are API-backed, so always true after first render)
  _hasHydrated: boolean;

  // LMS Data
  lmsData: LMSCourseData | null;
  
  // Current lesson being edited/viewed
  currentLessonId: string | null;
  currentSectionId: string | null;
  
  // History for undo/redo
  history: HistoryState;
  
  // UI State
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  isEditMode: boolean;
  
  // Panel states
  isSettingsPanelOpen: boolean;
  isTemplateSelectorOpen: boolean;
  
  // Section selection for inline editing
  selectedSection: LMSSectionType | null;
  hoveredSection: LMSSectionType | null;
}

// LMS Store Actions
interface LMSStoreActions {
  // Initialize / Reset
  initializeLMS: () => void;
  resetLMS: () => void;
  loadLMS: (data: LMSCourseData) => void;
  
  // Template
  setTemplate: (templateId: LMSTemplateId) => void;
  
  // Settings
  updateSettings: (settings: Partial<LMSSettings>) => void;
  
  // Current lesson navigation
  setCurrentLesson: (lessonId: string | null) => void;
  setCurrentSection: (sectionId: string | null) => void;
  navigateToLesson: (lessonId: string) => void;
  navigateToNextLesson: () => void;
  navigateToPrevLesson: () => void;
  
  // Section CRUD
  addSection: (title: string) => void;
  /** Merge a section from server (after createSection API). Does not set isDirty. */
  addSectionFromServer: (section: LMSSection) => void;
  updateSection: (sectionId: string, updates: Partial<LMSSection>) => void;
  removeSection: (sectionId: string) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  
  // Lesson CRUD
  addLesson: (sectionId: string, title: string) => void;
  /** Merge a lesson into a section from server (after createLesson/createLecture API). Does not set isDirty. */
  addLessonToSection: (sectionId: string, lesson: LMSLesson) => void;
  updateLesson: (sectionId: string, lessonId: string, updates: Partial<LMSLesson>) => void;
  removeLesson: (sectionId: string, lessonId: string) => void;
  reorderLessons: (sectionId: string, fromIndex: number, toIndex: number) => void;
  /**
   * Reorder all sections by an explicit ordered id list. Used by drag-and-drop
   * which already knows the final order. Snapshots to history; sets isDirty.
   */
  setSectionOrder: (orderedSectionIds: string[]) => void;
  /**
   * Reorder all lessons within a section by explicit ordered id list. Used by
   * drag-and-drop. Snapshots to history; sets isDirty.
   */
  setLessonOrder: (sectionId: string, orderedLessonIds: string[]) => void;
  /**
   * Cross-section lesson move. Removes the lesson from its current section and
   * inserts it at `toIndex` in the target section. Snapshots to history; sets
   * isDirty. No-op if the lesson isn't found.
   */
  moveLessonAcrossSections: (
    lessonId: string,
    fromSectionId: string,
    toSectionId: string,
    toIndex: number
  ) => void;
  /**
   * Replace the entire sections array (used for rollback on failed save and
   * for force-refetch on 409). Does NOT snapshot to history; the caller is
   * restoring state, not making an editable change.
   */
  setSections: (sections: LMSSection[]) => void;
  
  // Video config
  setLessonVideo: (sectionId: string, lessonId: string, video: LMSVideoConfig | undefined) => void;
  
  // Resources
  addResource: (sectionId: string, lessonId: string | null, resource: Omit<LMSResource, "id" | "order">) => void;
  updateResource: (sectionId: string, lessonId: string | null, resourceId: string, updates: Partial<LMSResource>) => void;
  removeResource: (sectionId: string, lessonId: string | null, resourceId: string) => void;
  
  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  
  // UI State
  setEditMode: (enabled: boolean) => void;
  toggleEditMode: () => void;
  selectSection: (section: LMSSectionType | null) => void;
  hoverSection: (section: LMSSectionType | null) => void;
  openSettingsPanel: () => void;
  closeSettingsPanel: () => void;
  openTemplateSelector: () => void;
  closeTemplateSelector: () => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  
  // Get current lesson and section data
  getCurrentLesson: () => LMSLesson | null;
  getCurrentSectionData: () => LMSSection | null;
  getAllLessons: () => LMSLesson[];
  
  // Export
  exportLMS: () => string;
}

export type LMSStore = LMSStoreState & LMSStoreActions;

// Helper function to reorder array items
function reorderArray<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...array];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

// Default empty LMS data
const getDefaultLMSData = (): LMSCourseData => ({
  course: {
    id: "",
    title: "Untitled Course",
    subTitle: "",
    slug: "",
    description: "",
    duration: "",
    mode: "SELF_PACED",
    difficulty: "NONE",
    type: "NORMAL",
    purchaseMode: "PAID",
    status: "DRAFT",
    validityDays: 365,
    language: "English",
    weight: 0,
    isYoungCourse: false,
    individualPricing: false,
    webPriceINR: 0,
    mobilePriceINR: 0,
    webPriceUSD: 0,
    mobilePriceUSD: 0,
    webDiscount: 0,
    mobileDiscount: 0,
    webThumbnailUrl: "",
    mobileThumbnailUrl: "",
    previewUrl: "",
    learningOutcomes: [],
    prerequisites: [],
    sections: [],
    offerings: [],
    faqs: [],
    recommendations: [],
    instructorIds: [],
    categoryIds: [],
    theme: {
      id: "default",
      name: "Default",
      description: "Default theme",
      colors: {
        light: {
          primary: "174 58% 39%",
          primaryForeground: "0 0% 100%",
          secondary: "215 20% 65%",
          secondaryForeground: "222 47% 11%",
          accent: "174 58% 39%",
          accentForeground: "0 0% 100%",
          background: "0 0% 100%",
          foreground: "222 47% 11%",
          muted: "210 40% 96%",
          mutedForeground: "215 16% 47%",
          card: "0 0% 100%",
          cardForeground: "222 47% 11%",
          border: "214 32% 91%",
          input: "214 32% 91%",
          ring: "174 58% 39%",
        },
        dark: {},
      },
      fonts: {
        heading: "Inter",
        body: "Inter",
        headingWeight: "700",
        bodyWeight: "400",
      },
      borderRadius: "0.5rem",
    },
  },
  sections: [],
  templateId: "classic",
  settings: DEFAULT_LMS_SETTINGS,
});

export const useLMSStore = create<LMSStore>()((set, get) => ({
  // Initial State (no persist: LMS content is always loaded from API via /lms page)
  _hasHydrated: true,
  lmsData: null,
      currentLessonId: null,
      currentSectionId: null,
      history: {
        past: [],
        future: [],
      },
      isLoading: false,
      isSaving: false,
      isDirty: false,
      isEditMode: true,
      isSettingsPanelOpen: false,
      isTemplateSelectorOpen: false,
      selectedSection: null,
      hoveredSection: null,

      // Initialize / Reset
      initializeLMS: () => {
        const defaultData = getDefaultLMSData();
        set({
          lmsData: defaultData,
          currentLessonId: null,
          currentSectionId: null,
          history: { past: [], future: [] },
          isDirty: false,
        });
      },

      resetLMS: () => {
        set({
          lmsData: null,
          currentLessonId: null,
          currentSectionId: null,
          history: { past: [], future: [] },
          isDirty: false,
          isLoading: false,
        });
      },

      loadLMS: (data) => {
        // Find first lesson to select by default
        let firstLessonId: string | null = null;
        let firstSectionId: string | null = null;
        if (data.sections.length > 0) {
          firstSectionId = data.sections[0].id;
          if (data.sections[0].lessons.length > 0) {
            firstLessonId = data.sections[0].lessons[0].id;
          }
        }
        
        set({
          lmsData: data,
          currentLessonId: firstLessonId,
          currentSectionId: firstSectionId,
          history: { past: [], future: [] },
          isDirty: false,
          isLoading: false,
        });
      },

      // Template
      setTemplate: (templateId) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        
        saveToHistory();
        set({
          lmsData: {
            ...lmsData,
            templateId,
          },
          isDirty: true,
        });
      },

      // Settings
      updateSettings: (settings) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        
        saveToHistory();
        set({
          lmsData: {
            ...lmsData,
            settings: {
              ...lmsData.settings,
              ...settings,
            },
          },
          isDirty: true,
        });
      },

      // Current lesson navigation
      setCurrentLesson: (lessonId) => {
        set({ currentLessonId: lessonId });
      },

      setCurrentSection: (sectionId) => {
        set({ currentSectionId: sectionId });
      },

      navigateToLesson: (lessonId) => {
        const { lmsData } = get();
        if (!lmsData) return;
        
        // Find section containing this lesson
        for (const section of lmsData.sections) {
          const lesson = section.lessons.find(l => l.id === lessonId);
          if (lesson) {
            set({
              currentLessonId: lessonId,
              currentSectionId: section.id,
            });
            break;
          }
        }
      },

      navigateToNextLesson: () => {
        const { lmsData, currentLessonId } = get();
        if (!lmsData || !currentLessonId) return;
        
        const allLessons = lmsData.sections.flatMap(s => s.lessons);
        const currentIndex = allLessons.findIndex(l => l.id === currentLessonId);
        
        if (currentIndex < allLessons.length - 1) {
          const nextLesson = allLessons[currentIndex + 1];
          get().navigateToLesson(nextLesson.id);
        }
      },

      navigateToPrevLesson: () => {
        const { lmsData, currentLessonId } = get();
        if (!lmsData || !currentLessonId) return;
        
        const allLessons = lmsData.sections.flatMap(s => s.lessons);
        const currentIndex = allLessons.findIndex(l => l.id === currentLessonId);
        
        if (currentIndex > 0) {
          const prevLesson = allLessons[currentIndex - 1];
          get().navigateToLesson(prevLesson.id);
        }
      },

      // Section CRUD
      addSection: (title) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        
        saveToHistory();
        const newSection = createLMSSection(title, lmsData.sections.length);
        
        set({
          lmsData: {
            ...lmsData,
            sections: [...lmsData.sections, newSection],
          },
          isDirty: true,
        });
      },

      addSectionFromServer: (section) => {
        const { lmsData } = get();
        if (!lmsData) return;
        set({
          lmsData: {
            ...lmsData,
            sections: [...lmsData.sections, { ...section, order: lmsData.sections.length }],
          },
        });
      },

      updateSection: (sectionId, updates) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        
        saveToHistory();
        set({
          lmsData: {
            ...lmsData,
            sections: lmsData.sections.map(section =>
              section.id === sectionId ? { ...section, ...updates } : section
            ),
          },
          isDirty: true,
        });
      },

      removeSection: (sectionId) => {
        const { lmsData, saveToHistory, currentSectionId } = get();
        if (!lmsData) return;
        
        saveToHistory();
        const sections = lmsData.sections
          .filter(section => section.id !== sectionId)
          .map((section, index) => ({ ...section, order: index }));
        
        // Update current section if needed
        let newCurrentSectionId = currentSectionId;
        let newCurrentLessonId = get().currentLessonId;
        
        if (currentSectionId === sectionId) {
          newCurrentSectionId = sections[0]?.id || null;
          newCurrentLessonId = sections[0]?.lessons[0]?.id || null;
        }
        
        set({
          lmsData: {
            ...lmsData,
            sections,
          },
          currentSectionId: newCurrentSectionId,
          currentLessonId: newCurrentLessonId,
          isDirty: true,
        });
      },

      reorderSections: (fromIndex, toIndex) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        
        saveToHistory();
        const sections = reorderArray(lmsData.sections, fromIndex, toIndex)
          .map((section, index) => ({ ...section, order: index }));
        
        set({
          lmsData: {
            ...lmsData,
            sections,
          },
          isDirty: true,
        });
      },

      // Lesson CRUD
      addLesson: (sectionId, title) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        
        saveToHistory();
        const sections = lmsData.sections.map(section => {
          if (section.id === sectionId) {
            const newLesson = createLMSLesson(title, section.lessons.length);
            return {
              ...section,
              lessons: [...section.lessons, newLesson],
            };
          }
          return section;
        });
        
        set({
          lmsData: {
            ...lmsData,
            sections,
          },
          isDirty: true,
        });
      },

      addLessonToSection: (sectionId, lesson) => {
        const { lmsData } = get();
        if (!lmsData) return;
        const sections = lmsData.sections.map(section => {
          if (section.id === sectionId) {
            const order = section.lessons.length;
            return {
              ...section,
              lessons: [...section.lessons, { ...lesson, order }],
            };
          }
          return section;
        });
        set({
          lmsData: {
            ...lmsData,
            sections,
          },
        });
      },

      updateLesson: (sectionId, lessonId, updates) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        
        saveToHistory();
        const sections = lmsData.sections.map(section => {
          if (section.id === sectionId) {
            return {
              ...section,
              lessons: section.lessons.map(lesson =>
                lesson.id === lessonId ? { ...lesson, ...updates } : lesson
              ),
            };
          }
          return section;
        });
        
        set({
          lmsData: {
            ...lmsData,
            sections,
          },
          isDirty: true,
        });
      },

      removeLesson: (sectionId, lessonId) => {
        const { lmsData, saveToHistory, currentLessonId } = get();
        if (!lmsData) return;
        
        saveToHistory();
        const sections = lmsData.sections.map(section => {
          if (section.id === sectionId) {
            return {
              ...section,
              lessons: section.lessons
                .filter(lesson => lesson.id !== lessonId)
                .map((lesson, index) => ({ ...lesson, order: index })),
            };
          }
          return section;
        });
        
        // Update current lesson if needed
        let newCurrentLessonId = currentLessonId;
        if (currentLessonId === lessonId) {
          const allLessons = sections.flatMap(s => s.lessons);
          newCurrentLessonId = allLessons[0]?.id || null;
        }
        
        set({
          lmsData: {
            ...lmsData,
            sections,
          },
          currentLessonId: newCurrentLessonId,
          isDirty: true,
        });
      },

      reorderLessons: (sectionId, fromIndex, toIndex) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;

        saveToHistory();
        const sections = lmsData.sections.map(section => {
          if (section.id === sectionId) {
            const lessons = reorderArray(section.lessons, fromIndex, toIndex)
              .map((lesson, index) => ({ ...lesson, order: index }));
            return { ...section, lessons };
          }
          return section;
        });

        set({
          lmsData: {
            ...lmsData,
            sections,
          },
          isDirty: true,
        });
      },

      setSectionOrder: (orderedSectionIds) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        // Preserve full section objects (lessons + resources) while reordering.
        const byId = new Map(lmsData.sections.map((s) => [s.id, s]));
        const reordered: LMSSection[] = [];
        orderedSectionIds.forEach((id, index) => {
          const sec = byId.get(id);
          if (sec) reordered.push({ ...sec, order: index });
        });
        // Append any sections not present in the ordered list to avoid data
        // loss if the caller passes a partial list (defensive; should not
        // happen when caller derives ids from current state).
        for (const sec of lmsData.sections) {
          if (!orderedSectionIds.includes(sec.id)) {
            reordered.push({ ...sec, order: reordered.length });
          }
        }
        saveToHistory();
        set({
          lmsData: { ...lmsData, sections: reordered },
          isDirty: true,
        });
      },

      setLessonOrder: (sectionId, orderedLessonIds) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        saveToHistory();
        const sections = lmsData.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const byId = new Map(section.lessons.map((l) => [l.id, l]));
          const reordered: LMSLesson[] = [];
          orderedLessonIds.forEach((id, index) => {
            const les = byId.get(id);
            if (les) reordered.push({ ...les, order: index });
          });
          for (const les of section.lessons) {
            if (!orderedLessonIds.includes(les.id)) {
              reordered.push({ ...les, order: reordered.length });
            }
          }
          return { ...section, lessons: reordered };
        });
        set({
          lmsData: { ...lmsData, sections },
          isDirty: true,
        });
      },

      moveLessonAcrossSections: (lessonId, fromSectionId, toSectionId, toIndex) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        if (fromSectionId === toSectionId) return;
        // Find the lesson to move
        const source = lmsData.sections.find((s) => s.id === fromSectionId);
        const moved = source?.lessons.find((l) => l.id === lessonId);
        if (!source || !moved) return;
        saveToHistory();
        const sections = lmsData.sections.map((section) => {
          if (section.id === fromSectionId) {
            const lessons = section.lessons
              .filter((l) => l.id !== lessonId)
              .map((l, index) => ({ ...l, order: index }));
            return { ...section, lessons };
          }
          if (section.id === toSectionId) {
            const lessons = [...section.lessons];
            const safeIndex = Math.max(0, Math.min(toIndex, lessons.length));
            lessons.splice(safeIndex, 0, moved);
            return {
              ...section,
              lessons: lessons.map((l, index) => ({ ...l, order: index })),
            };
          }
          return section;
        });
        set({
          lmsData: { ...lmsData, sections },
          isDirty: true,
        });
      },

      setSections: (sections) => {
        const { lmsData } = get();
        if (!lmsData) return;
        // Pure state replacement, no history snapshot (used for rollback /
        // post-409 refetch where the change is not a user edit).
        set({
          lmsData: { ...lmsData, sections },
        });
      },

      // Video config
      setLessonVideo: (sectionId, lessonId, video) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        
        saveToHistory();
        const sections = lmsData.sections.map(section => {
          if (section.id === sectionId) {
            return {
              ...section,
              lessons: section.lessons.map(lesson =>
                lesson.id === lessonId ? { ...lesson, video } : lesson
              ),
            };
          }
          return section;
        });
        
        set({
          lmsData: {
            ...lmsData,
            sections,
          },
          isDirty: true,
        });
      },

      // Resources
      addResource: (sectionId, lessonId, resourceData) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        
        saveToHistory();
        const sections = lmsData.sections.map(section => {
          if (section.id === sectionId) {
            if (lessonId) {
              // Add to lesson
              return {
                ...section,
                lessons: section.lessons.map(lesson => {
                  if (lesson.id === lessonId) {
                    const newResource = createLMSResource(
                      resourceData.type,
                      resourceData.title,
                      lesson.resources.length
                    );
                    return {
                      ...lesson,
                      resources: [...lesson.resources, { ...newResource, ...resourceData }],
                    };
                  }
                  return lesson;
                }),
              };
            } else {
              // Add to section
              const newResource = createLMSResource(
                resourceData.type,
                resourceData.title,
                section.resources.length
              );
              return {
                ...section,
                resources: [...section.resources, { ...newResource, ...resourceData }],
              };
            }
          }
          return section;
        });
        
        set({
          lmsData: {
            ...lmsData,
            sections,
          },
          isDirty: true,
        });
      },

      updateResource: (sectionId, lessonId, resourceId, updates) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        
        saveToHistory();
        const sections = lmsData.sections.map(section => {
          if (section.id === sectionId) {
            if (lessonId) {
              return {
                ...section,
                lessons: section.lessons.map(lesson => {
                  if (lesson.id === lessonId) {
                    return {
                      ...lesson,
                      resources: lesson.resources.map(r =>
                        r.id === resourceId ? { ...r, ...updates } : r
                      ),
                    };
                  }
                  return lesson;
                }),
              };
            } else {
              return {
                ...section,
                resources: section.resources.map(r =>
                  r.id === resourceId ? { ...r, ...updates } : r
                ),
              };
            }
          }
          return section;
        });
        
        set({
          lmsData: {
            ...lmsData,
            sections,
          },
          isDirty: true,
        });
      },

      removeResource: (sectionId, lessonId, resourceId) => {
        const { lmsData, saveToHistory } = get();
        if (!lmsData) return;
        
        saveToHistory();
        const sections = lmsData.sections.map(section => {
          if (section.id === sectionId) {
            if (lessonId) {
              return {
                ...section,
                lessons: section.lessons.map(lesson => {
                  if (lesson.id === lessonId) {
                    return {
                      ...lesson,
                      resources: lesson.resources.filter(r => r.id !== resourceId),
                    };
                  }
                  return lesson;
                }),
              };
            } else {
              return {
                ...section,
                resources: section.resources.filter(r => r.id !== resourceId),
              };
            }
          }
          return section;
        });
        
        set({
          lmsData: {
            ...lmsData,
            sections,
          },
          isDirty: true,
        });
      },

      // History
      saveToHistory: () => {
        const { lmsData, history } = get();
        if (!lmsData) return;
        
        set({
          history: {
            past: [...history.past.slice(-19), lmsData],
            future: [],
          },
        });
      },

      undo: () => {
        const { history, lmsData } = get();
        if (history.past.length === 0 || !lmsData) return;
        
        const previous = history.past[history.past.length - 1];
        const newPast = history.past.slice(0, -1);
        
        set({
          lmsData: previous,
          history: {
            past: newPast,
            future: [lmsData, ...history.future],
          },
        });
      },

      redo: () => {
        const { history, lmsData } = get();
        if (history.future.length === 0 || !lmsData) return;
        
        const next = history.future[0];
        const newFuture = history.future.slice(1);
        
        set({
          lmsData: next,
          history: {
            past: [...history.past, lmsData],
            future: newFuture,
          },
        });
      },

      // UI State
      setEditMode: (enabled) => {
        set({ isEditMode: enabled });
      },

      toggleEditMode: () => {
        set(state => ({ isEditMode: !state.isEditMode }));
      },

      selectSection: (section) => {
        set({ selectedSection: section });
      },

      hoverSection: (section) => {
        set({ hoveredSection: section });
      },

      openSettingsPanel: () => {
        set({
          isSettingsPanelOpen: true,
          isTemplateSelectorOpen: false,
        });
      },

      closeSettingsPanel: () => {
        set({ isSettingsPanelOpen: false });
      },

      openTemplateSelector: () => {
        set({
          isTemplateSelectorOpen: true,
          isSettingsPanelOpen: false,
        });
      },

      closeTemplateSelector: () => {
        set({ isTemplateSelectorOpen: false });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setSaving: (saving) => {
        set({ isSaving: saving });
      },

      // Get current lesson and section data
      getCurrentLesson: () => {
        const { lmsData, currentLessonId } = get();
        if (!lmsData || !currentLessonId) return null;
        
        for (const section of lmsData.sections) {
          const lesson = section.lessons.find(l => l.id === currentLessonId);
          if (lesson) return lesson;
        }
        return null;
      },

      getCurrentSectionData: () => {
        const { lmsData, currentSectionId } = get();
        if (!lmsData || !currentSectionId) return null;
        
        return lmsData.sections.find(s => s.id === currentSectionId) || null;
      },

      getAllLessons: () => {
        const { lmsData } = get();
        if (!lmsData) return [];
        
        return lmsData.sections.flatMap(s => s.lessons);
      },

  // Export
  exportLMS: () => {
    const { lmsData } = get();
    return JSON.stringify(lmsData, null, 2);
  },
}));
