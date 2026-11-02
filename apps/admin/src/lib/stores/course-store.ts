import {
  getDefaultCourseFormData,
  generateCourseSlug,
  createCourseSection,
  createCourseModule,
  createCourseLecture,
  createCourseOffering,
  createCourseFAQ,
  normalizeSectionModules,
} from "@open-mtlms/shared";
import type {
  CourseFormData,
  CourseSectionData,
  CourseLecture,
  CourseOfferingData,
  CourseFAQData,
  CourseRecommendationData,
  CourseThemeConfig,
  CourseMode,
} from "@open-mtlms/shared/types";
import {
  getCourseTemplate,
  getCourseThemeConfig,
} from "@open-mtlms/ui-config";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// History state for undo/redo
interface HistoryState {
  past: CourseFormData[];
  future: CourseFormData[];
}

// Validation errors
interface ValidationErrors {
  title?: string;
  subTitle?: string;
  slug?: string;
  duration?: string;
  webThumbnailUrl?: string;
  learningOutcomes?: string;
  sections?: string;
  [key: string]: string | undefined;
}

// Course section types for the editor
export type CourseSectionType = 
  | "hero"
  | "pricing"
  | "learning"
  | "syllabus"
  | "includes"
  | "requirements"
  | "description"
  | "instructor"
  | "faq";

// Page template types (visual design templates)
export type CoursePageTemplateId = "modern";

// Course Store State
interface CourseStoreState {
  // Form data
  courseData: CourseFormData;
  
  // Page template (visual design) and theme
  selectedPageTemplate: CoursePageTemplateId;
  selectedTemplateId: string; // Legacy: course type template
  selectedThemeId: string;
  
  // History for undo/redo
  history: HistoryState;
  
  // UI State
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  isEditMode: boolean;
  
  // Validation
  errors: ValidationErrors;
  isValid: boolean;
  
  // Editor panel states
  isEditPanelOpen: boolean;
  isThemePanelOpen: boolean;
  isPreviewFullscreen: boolean;
  
  // Section selection for full-screen editor
  selectedSection: CourseSectionType | null;
  hoveredSection: CourseSectionType | null;
  
  // Legacy: Active section for split-view editing
  activeSection: "basic" | "settings" | "pricing" | "media" | "content" | "instructor" | "faq" | null;
}

// Course Store Actions
interface CourseStoreActions {
  // Initialize / Reset
  initializeCourse: (courseId?: string) => void;
  resetCourse: () => void;
  loadCourse: (data: CourseFormData) => void;
  
  // Page Template (visual design)
  setPageTemplate: (templateId: CoursePageTemplateId) => void;
  
  // Template & Theme
  applyTemplate: (templateId: string) => void;
  setTheme: (themeId: string) => void;
  updateTheme: (theme: Partial<CourseThemeConfig>) => void;
  
  // Basic Info Updates
  updateBasicInfo: (updates: Partial<Pick<CourseFormData, "title" | "subTitle" | "slug" | "description" | "duration">>) => void;
  updateTitle: (title: string) => void;
  generateSlug: () => void;
  
  // Settings Updates
  updateSettings: (updates: Partial<Pick<CourseFormData, "mode" | "type" | "difficulty" | "purchaseMode" | "status" | "language" | "languages" | "weight" | "isYoungCourse" | "individualPricing" | "validityDays">>) => void;
  setMode: (mode: CourseMode) => void;
  
  // Section Labels Updates (for editable section headings and pricing card text)
  updateSectionLabels: (updates: Partial<Pick<CourseFormData, 
    "sectionHeadlineLearningOutcomes" | 
    "sectionHeadlineCourseContent" | 
    "sectionHeadlineOfferings" | 
    "sectionHeadlineRequirements" | 
    "sectionHeadlineDescription" | 
    "sectionHeadlineInstructor" | 
    "sectionHeadlineFaq" | 
    "pricingPlusHeadline" | 
    "pricingPlusSubtext" | 
    "pricingGuaranteeText"
  >>) => void;
  
  // Pricing Updates
  updatePricing: (updates: Partial<Pick<CourseFormData, "webPriceINR" | "mobilePriceINR" | "webPriceUSD" | "mobilePriceUSD" | "webDiscount" | "mobileDiscount" | "prices">>) => void;
  
  // Media Updates
  updateMedia: (updates: Partial<Pick<CourseFormData, "webThumbnailUrl" | "mobileThumbnailUrl" | "previewUrl" | "thumbnailKey" | "secondaryThumbnailKey" | "previewKey">>) => void;
  
  // Learning Outcomes
  addLearningOutcome: (outcome: string) => void;
  updateLearningOutcome: (index: number, outcome: string) => void;
  removeLearningOutcome: (index: number) => void;
  reorderLearningOutcomes: (fromIndex: number, toIndex: number) => void;
  
  // Prerequisites
  addPrerequisite: (prerequisite: string) => void;
  updatePrerequisite: (index: number, prerequisite: string) => void;
  removePrerequisite: (index: number) => void;
  
  // Course Content (Sections & Lectures)
  addSection: (title: string) => void;
  updateSection: (sectionId: string, updates: Partial<CourseSectionData>) => void;
  removeSection: (sectionId: string) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  /** Replace the curriculum sections wholesale (e.g. synced from the real LMS
   *  curriculum so the landing syllabus can't drift out of sync). */
  syncSectionsFromLms: (sections: CourseSectionData[]) => void;
  
  duplicateSection: (sectionId: string) => void;
  addModule: (sectionId: string, title: string) => void;
  updateModule: (sectionId: string, moduleId: string, updates: Partial<{ title: string }>) => void;
  removeModule: (sectionId: string, moduleId: string) => void;
  reorderModules: (sectionId: string, fromIndex: number, toIndex: number) => void;
  duplicateModule: (sectionId: string, moduleId: string) => void;
  addLecture: (sectionId: string, moduleId: string, title: string) => void;
  updateLecture: (sectionId: string, moduleId: string, lectureId: string, updates: Partial<CourseLecture>) => void;
  removeLecture: (sectionId: string, moduleId: string, lectureId: string) => void;
  reorderLectures: (sectionId: string, moduleId: string, fromIndex: number, toIndex: number) => void;
  duplicateLecture: (sectionId: string, moduleId: string, lectureId: string) => void;
  
  // Course Includes (Offerings)
  addOffering: (icon: string, text: string) => void;
  updateOffering: (offeringId: string, updates: Partial<CourseOfferingData>) => void;
  removeOffering: (offeringId: string) => void;
  
  // FAQs
  addFAQ: (question: string, answer: string) => void;
  updateFAQ: (faqId: string, updates: Partial<CourseFAQData>) => void;
  removeFAQ: (faqId: string) => void;
  reorderFAQs: (fromIndex: number, toIndex: number) => void;

  // Course Recommendations
  addRecommendation: (rec: CourseRecommendationData) => void;
  removeRecommendation: (recId: string) => void;
  reorderRecommendations: (fromIndex: number, toIndex: number) => void;
  setRecommendations: (recommendations: CourseRecommendationData[]) => void;

  // Section visibility (hide/show sections)
  toggleSectionVisibility: (sectionKey: string) => void;
  
  // Course rating (from LMS avg or admin override)
  updateRating: (rating: number, ratingTotalCount?: number) => void;
  
  // Instructors (Mentors) - multiple allowed
  addInstructor: (instructorId: string) => void;
  removeInstructor: (instructorId: string) => void;
  setInstructors: (instructorIds: string[]) => void;
  
  // Categories
  addCategory: (categoryId: string) => void;
  removeCategory: (categoryId: string) => void;
  setCategories: (categoryIds: string[]) => void;
  
  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  
  // Validation
  validate: () => boolean;
  clearErrors: () => void;
  
  // UI State
  setActiveSection: (section: CourseStoreState["activeSection"]) => void;
  toggleThemePanel: () => void;
  togglePreviewFullscreen: () => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  
  // Full-screen editor actions
  setEditMode: (enabled: boolean) => void;
  toggleEditMode: () => void;
  selectSection: (section: CourseSectionType | null) => void;
  hoverSection: (section: CourseSectionType | null) => void;
  openEditPanel: (section: CourseSectionType) => void;
  closeEditPanel: () => void;
  closePanels: () => void;
  
  // Export/Import
  exportCourse: () => string;
  importCourse: (json: string) => boolean;
}

export type CourseStore = CourseStoreState & CourseStoreActions;

// Helper function to reorder array items
function reorderArray<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...array];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Carry the preview videos attached in the syllabus editor across an LMS sync.
 *
 * They live only on the landing page, so a syllabus rebuilt from the LMS has
 * none, and replacing it wholesale would delete every one the next time the
 * page is saved. A synced syllabus shares its lecture ids with the LMS, so the
 * id is the match. One built by hand in this editor shares none, so on that
 * first sync a title naming exactly one lecture on each side stands in for it.
 * Titles are never used once an id is shared: a lesson deleted and remade under
 * the same name must not inherit a preview whose video went with the old one.
 */
function keepPreviewVideos(
  current: CourseSectionData[],
  incoming: CourseSectionData[]
): CourseSectionData[] {
  const lecturesOf = (sections: CourseSectionData[]) =>
    sections.flatMap((s) => normalizeSectionModules(s).modules.flatMap((m) => m.lectures));
  const titleOf = (lecture: CourseLecture) => lecture.title.trim().toLowerCase();
  const countTitles = (lectures: CourseLecture[]) => {
    const counts = new Map<string, number>();
    for (const l of lectures) counts.set(titleOf(l), (counts.get(titleOf(l)) ?? 0) + 1);
    return counts;
  };

  const previous = lecturesOf(current);
  const next = lecturesOf(incoming);
  const nextIds = new Set(next.map((l) => l.id));
  const synced = previous.some((l) => nextIds.has(l.id));
  const titlesBefore = countTitles(previous);
  const titlesAfter = countTitles(next);
  const keyOf = (lecture: CourseLecture): string | undefined => {
    if (synced) return lecture.id;
    const title = titleOf(lecture);
    return titlesBefore.get(title) === 1 && titlesAfter.get(title) === 1 ? title : undefined;
  };

  const previews = new Map<string, NonNullable<CourseLecture["previewVideo"]>>();
  for (const l of previous) {
    const key = keyOf(l);
    if (key && l.previewVideo) previews.set(key, l.previewVideo);
  }
  if (previews.size === 0) return incoming;

  return incoming.map((section) => {
    const norm = normalizeSectionModules(section);
    return {
      ...norm,
      modules: norm.modules.map((m) => ({
        ...m,
        lectures: m.lectures.map((l) => {
          const key = keyOf(l);
          const previewVideo = key ? previews.get(key) : undefined;
          if (!previewVideo || l.previewVideo) return l;
          // Same pair the syllabus editor writes when a preview is attached.
          return { ...l, previewVideo, previewUrl: "preview" };
        }),
      })),
    };
  });
}

export const useCourseStore = create<CourseStore>()(
  persist(
    (set, get) => ({
      // Initial State
      courseData: getDefaultCourseFormData(),
      selectedPageTemplate: "modern",
      selectedTemplateId: "self-paced",
      selectedThemeId: "sunset-orange",
      history: {
        past: [],
        future: [],
      },
      isLoading: false,
      isSaving: false,
      isDirty: false,
      isEditMode: true,
      errors: {},
      isValid: true,
      isEditPanelOpen: false,
      isThemePanelOpen: false,
      isPreviewFullscreen: false,
      selectedSection: null,
      hoveredSection: null,
      activeSection: "basic",

      // Initialize / Reset
      initializeCourse: (courseId) => {
        if (courseId) {
          // TODO: Fetch course from API
          set({ isLoading: true });
        } else {
          const defaultData = getDefaultCourseFormData();
          set({
            courseData: defaultData,
            selectedTemplateId: "self-paced",
            selectedThemeId: "sunset-orange",
            history: { past: [], future: [] },
            isDirty: false,
            errors: {},
            isValid: true,
          });
        }
      },

      resetCourse: () => {
        const defaultData = getDefaultCourseFormData();
        set({
          courseData: defaultData,
          selectedTemplateId: "self-paced",
          selectedThemeId: "sunset-orange",
          history: { past: [], future: [] },
          isDirty: false,
          errors: {},
          isValid: true,
        });
      },

      loadCourse: (data) => {
        const normalizedData = {
          ...data,
          sections: data.sections.map((s) => normalizeSectionModules(s)),
        };
        set({
          courseData: normalizedData,
          selectedThemeId: normalizedData.theme?.id || "ocean-blue",
          history: { past: [], future: [] },
          isDirty: false,
          isLoading: false,
        });
      },

      // Page Template (visual design)
      setPageTemplate: (templateId) => {
        set({ selectedPageTemplate: templateId });
      },

      // Template & Theme
      applyTemplate: (templateId) => {
        const { saveToHistory } = get();
        saveToHistory();
        
        const template = getCourseTemplate(templateId);
        if (template) {
          const currentData = get().courseData;
          set({
            courseData: {
              ...currentData,
              ...template.defaultContent,
              theme: template.defaultTheme,
              // Preserve existing id and tenant info
              id: currentData.id,
              tenantId: currentData.tenantId,
            } as CourseFormData,
            selectedTemplateId: templateId,
            selectedThemeId: template.defaultTheme.id,
            isDirty: true,
          });
        }
      },

      setTheme: (themeId) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        const themeConfig = getCourseThemeConfig(themeId);
        set({
          courseData: {
            ...courseData,
            theme: themeConfig,
          },
          selectedThemeId: themeId,
          isDirty: true,
        });
      },

      updateTheme: (themeUpdates) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            theme: {
              ...courseData.theme,
              ...themeUpdates,
            },
          },
          isDirty: true,
        });
      },

      // Basic Info Updates
      updateBasicInfo: (updates) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            ...updates,
          },
          isDirty: true,
        });
      },

      updateTitle: (title) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        const slug = generateCourseSlug(title);
        set({
          courseData: {
            ...courseData,
            title,
            slug,
          },
          isDirty: true,
        });
      },

      generateSlug: () => {
        const { courseData } = get();
        const slug = generateCourseSlug(courseData.title);
        set({
          courseData: {
            ...courseData,
            slug,
          },
          isDirty: true,
        });
      },

      // Settings Updates
      updateSettings: (updates) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        const additionalUpdates: Partial<CourseFormData> = {};
        // When languages array is set, keep language in sync with first item
        if (updates.languages !== undefined) {
          additionalUpdates.language = (updates.languages[0] as CourseFormData["language"]) ?? courseData.language;
        }
        
        set({
          courseData: {
            ...courseData,
            ...updates,
            ...additionalUpdates,
          },
          isDirty: true,
        });
      },

      setMode: (mode) => {
        const { updateSettings } = get();
        updateSettings({ mode });
      },

      // Section Labels Updates (for editable section headings and pricing card text)
      updateSectionLabels: (updates) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            ...updates,
          },
          isDirty: true,
        });
      },

      // Pricing Updates
      updatePricing: (updates) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            ...updates,
          },
          isDirty: true,
        });
      },

      // Media Updates
      updateMedia: (updates) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            ...updates,
          },
          isDirty: true,
        });
      },

      // Learning Outcomes
      addLearningOutcome: (outcome) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            learningOutcomes: [...courseData.learningOutcomes, outcome],
          },
          isDirty: true,
        });
      },

      updateLearningOutcome: (index, outcome) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        const learningOutcomes = [...courseData.learningOutcomes];
        learningOutcomes[index] = outcome;
        
        set({
          courseData: {
            ...courseData,
            learningOutcomes,
          },
          isDirty: true,
        });
      },

      removeLearningOutcome: (index) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            learningOutcomes: courseData.learningOutcomes.filter((_, i) => i !== index),
          },
          isDirty: true,
        });
      },

      reorderLearningOutcomes: (fromIndex, toIndex) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            learningOutcomes: reorderArray(courseData.learningOutcomes, fromIndex, toIndex),
          },
          isDirty: true,
        });
      },

      // Prerequisites
      addPrerequisite: (prerequisite) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            prerequisites: [...courseData.prerequisites, prerequisite],
          },
          isDirty: true,
        });
      },

      updatePrerequisite: (index, prerequisite) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        const prerequisites = [...courseData.prerequisites];
        prerequisites[index] = prerequisite;
        
        set({
          courseData: {
            ...courseData,
            prerequisites,
          },
          isDirty: true,
        });
      },

      removePrerequisite: (index) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            prerequisites: courseData.prerequisites.filter((_, i) => i !== index),
          },
          isDirty: true,
        });
      },

      // Course Content (Sections & Lectures)
      addSection: (title) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        const newSection = createCourseSection(title, courseData.sections.length);
        
        set({
          courseData: {
            ...courseData,
            sections: [...courseData.sections, newSection],
          },
          isDirty: true,
        });
      },

      updateSection: (sectionId, updates) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            sections: courseData.sections.map((section) =>
              section.id === sectionId ? { ...section, ...updates } : section
            ),
          },
          isDirty: true,
        });
      },

      removeSection: (sectionId) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        const sections = courseData.sections
          .filter((section) => section.id !== sectionId)
          .map((section, index) => ({ ...section, order: index }));
        
        set({
          courseData: {
            ...courseData,
            sections,
          },
          isDirty: true,
        });
      },

      reorderSections: (fromIndex, toIndex) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        const sections = reorderArray(courseData.sections, fromIndex, toIndex)
          .map((section, index) => ({ ...section, order: index }));
        
        set({
          courseData: {
            ...courseData,
            sections,
          },
          isDirty: true,
        });
      },

      syncSectionsFromLms: (incoming) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();

        const sections = keepPreviewVideos(courseData.sections, incoming).map((section, index) => ({
          ...normalizeSectionModules(section),
          order: index,
        }));

        set({
          courseData: {
            ...courseData,
            sections,
          },
          isDirty: true,
        });
      },

      duplicateSection: (sectionId) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const section = courseData.sections.find((s) => s.id === sectionId);
        if (!section) return;
        const norm = normalizeSectionModules(section);
        const newId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newSection: CourseSectionData = {
          ...norm,
          id: newId,
          title: `${norm.title} (copy)`,
          order: courseData.sections.length,
          modules: norm.modules.map((m) => ({
            ...m,
            id: `module-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            lectures: m.lectures.map((l) => ({
              ...l,
              id: `lecture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            })),
          })),
        };
        set({
          courseData: { ...courseData, sections: [...courseData.sections, newSection] },
          isDirty: true,
        });
      },

      addModule: (sectionId, title) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const sections = courseData.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const norm = normalizeSectionModules(section);
          const newModule = createCourseModule(title, norm.modules.length);
          return { ...norm, modules: [...norm.modules, newModule] };
        });
        set({ courseData: { ...courseData, sections }, isDirty: true });
      },

      updateModule: (sectionId, moduleId, updates) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const sections = courseData.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const norm = normalizeSectionModules(section);
          return {
            ...norm,
            modules: norm.modules.map((m) =>
              m.id === moduleId ? { ...m, ...updates } : m
            ),
          };
        });
        set({ courseData: { ...courseData, sections }, isDirty: true });
      },

      removeModule: (sectionId, moduleId) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const sections = courseData.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const norm = normalizeSectionModules(section);
          return {
            ...norm,
            modules: norm.modules
              .filter((m) => m.id !== moduleId)
              .map((m, i) => ({ ...m, order: i })),
          };
        });
        set({ courseData: { ...courseData, sections }, isDirty: true });
      },

      reorderModules: (sectionId, fromIndex, toIndex) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const sections = courseData.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const norm = normalizeSectionModules(section);
          const reordered = reorderArray(norm.modules, fromIndex, toIndex)
            .map((m, i) => ({ ...m, order: i }));
          return { ...norm, modules: reordered };
        });
        set({ courseData: { ...courseData, sections }, isDirty: true });
      },

      duplicateModule: (sectionId, moduleId) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const sections = courseData.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const norm = normalizeSectionModules(section);
          const mod = norm.modules.find((m) => m.id === moduleId);
          if (!mod) return section;
          const newMod = {
            ...mod,
            id: `module-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: `${mod.title} (copy)`,
            order: norm.modules.length,
            lectures: mod.lectures.map((l) => ({
              ...l,
              id: `lecture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            })),
          };
          return { ...norm, modules: [...norm.modules, newMod] };
        });
        set({ courseData: { ...courseData, sections }, isDirty: true });
      },

      addLecture: (sectionId, moduleId, title) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const sections = courseData.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const norm = normalizeSectionModules(section);
          const modules = norm.modules.map((m) => {
            if (m.id !== moduleId) return m;
            const newLecture = createCourseLecture(title, m.lectures.length);
            return { ...m, lectures: [...m.lectures, newLecture] };
          });
          return { ...norm, modules };
        });
        set({ courseData: { ...courseData, sections }, isDirty: true });
      },

      updateLecture: (sectionId, moduleId, lectureId, updates) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const sections = courseData.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const norm = normalizeSectionModules(section);
          const modules = norm.modules.map((m) => {
            if (m.id !== moduleId) return m;
            return {
              ...m,
              lectures: m.lectures.map((l) =>
                l.id === lectureId ? { ...l, ...updates } : l
              ),
            };
          });
          return { ...norm, modules };
        });
        set({ courseData: { ...courseData, sections }, isDirty: true });
      },

      removeLecture: (sectionId, moduleId, lectureId) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const sections = courseData.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const norm = normalizeSectionModules(section);
          const modules = norm.modules.map((m) => {
            if (m.id !== moduleId) return m;
            return {
              ...m,
              lectures: m.lectures
                .filter((l) => l.id !== lectureId)
                .map((l, i) => ({ ...l, order: i })),
            };
          });
          return { ...norm, modules };
        });
        set({ courseData: { ...courseData, sections }, isDirty: true });
      },

      duplicateLecture: (sectionId, moduleId, lectureId) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const sections = courseData.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const norm = normalizeSectionModules(section);
          const modules = norm.modules.map((m) => {
            if (m.id !== moduleId) return m;
            const lecture = m.lectures.find((l) => l.id === lectureId);
            if (!lecture) return m;
            const newLecture: CourseLecture = {
              ...lecture,
              id: `lecture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              title: `${lecture.title} (copy)`,
              order: m.lectures.length,
            };
            return { ...m, lectures: [...m.lectures, newLecture] };
          });
          return { ...norm, modules };
        });
        set({ courseData: { ...courseData, sections }, isDirty: true });
      },

      reorderLectures: (sectionId, moduleId, fromIndex, toIndex) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const sections = courseData.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const norm = normalizeSectionModules(section);
          const modules = norm.modules.map((m) => {
            if (m.id !== moduleId) return m;
            const reordered = reorderArray(m.lectures, fromIndex, toIndex)
              .map((l, i) => ({ ...l, order: i }));
            return { ...m, lectures: reordered };
          });
          return { ...norm, modules };
        });
        set({ courseData: { ...courseData, sections }, isDirty: true });
      },

      // Course Includes (Offerings)
      addOffering: (icon, text) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        const newOffering = createCourseOffering(icon, text);
        
        set({
          courseData: {
            ...courseData,
            offerings: [...courseData.offerings, newOffering],
          },
          isDirty: true,
        });
      },

      updateOffering: (offeringId, updates) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            offerings: courseData.offerings.map((offering) =>
              offering.id === offeringId ? { ...offering, ...updates } : offering
            ),
          },
          isDirty: true,
        });
      },

      removeOffering: (offeringId) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            offerings: courseData.offerings.filter((offering) => offering.id !== offeringId),
          },
          isDirty: true,
        });
      },

      // FAQs
      addFAQ: (question, answer) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        const newFAQ = createCourseFAQ(question, answer);
        
        set({
          courseData: {
            ...courseData,
            faqs: [...courseData.faqs, newFAQ],
          },
          isDirty: true,
        });
      },

      updateFAQ: (faqId, updates) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            faqs: courseData.faqs.map((faq) =>
              faq.id === faqId ? { ...faq, ...updates } : faq
            ),
          },
          isDirty: true,
        });
      },

      removeFAQ: (faqId) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            faqs: courseData.faqs.filter((faq) => faq.id !== faqId),
          },
          isDirty: true,
        });
      },

      reorderFAQs: (fromIndex, toIndex) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            faqs: reorderArray(courseData.faqs, fromIndex, toIndex),
          },
          isDirty: true,
        });
      },

      // Course Recommendations
      addRecommendation: (rec) => {
        const { saveToHistory, courseData } = get();
        const recs = courseData.recommendations || [];
        if (recs.some((r) => r.courseId === rec.courseId)) return;
        saveToHistory();
        set({
          courseData: {
            ...courseData,
            recommendations: [...recs, { ...rec, sortOrder: recs.length }],
          },
          isDirty: true,
        });
      },

      removeRecommendation: (recId) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        set({
          courseData: {
            ...courseData,
            recommendations: (courseData.recommendations || []).filter((r) => r.id !== recId),
          },
          isDirty: true,
        });
      },

      reorderRecommendations: (fromIndex, toIndex) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const recs = courseData.recommendations || [];
        set({
          courseData: {
            ...courseData,
            recommendations: reorderArray(recs, fromIndex, toIndex).map((r, i) => ({ ...r, sortOrder: i })),
          },
          isDirty: true,
        });
      },

      setRecommendations: (recommendations) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        set({
          courseData: {
            ...courseData,
            recommendations: recommendations.map((r, i) => ({ ...r, sortOrder: i })),
          },
          isDirty: true,
        });
      },

      toggleSectionVisibility: (sectionKey) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const sv = courseData.sectionVisibility ?? {};
        const next = { ...sv, [sectionKey]: !(sv[sectionKey] !== false) };
        set({
          courseData: {
            ...courseData,
            sectionVisibility: next,
          },
          isDirty: true,
        });
      },

      updateRating: (rating, ratingTotalCount) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        const clamped = Math.min(5, Math.max(1, Number(rating)));
        const rounded = Number(clamped.toFixed(1));
        set({
          courseData: {
            ...courseData,
            rating: rounded,
            ratingTotalCount: ratingTotalCount ?? courseData.ratingTotalCount,
          },
          isDirty: true,
        });
      },

      // Instructors (Mentors) - multiple allowed
      addInstructor: (instructorId) => {
        const { saveToHistory, courseData } = get();
        const currentInstructorIds = courseData.instructorIds || [];
        if (currentInstructorIds.includes(instructorId)) return;
        
        saveToHistory();
        set({
          courseData: {
            ...courseData,
            instructorIds: [...currentInstructorIds, instructorId],
          },
          isDirty: true,
        });
      },

      removeInstructor: (instructorId) => {
        const { saveToHistory, courseData } = get();
        const currentInstructorIds = courseData.instructorIds || [];
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            instructorIds: currentInstructorIds.filter((id) => id !== instructorId),
          },
          isDirty: true,
        });
      },

      setInstructors: (instructorIds) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            instructorIds,
          },
          isDirty: true,
        });
      },

      // Categories
      addCategory: (categoryId) => {
        const { saveToHistory, courseData } = get();
        const currentCategoryIds = courseData.categoryIds || [];
        if (currentCategoryIds.includes(categoryId)) return;
        
        saveToHistory();
        set({
          courseData: {
            ...courseData,
            categoryIds: [...currentCategoryIds, categoryId],
          },
          isDirty: true,
        });
      },

      removeCategory: (categoryId) => {
        const { saveToHistory, courseData } = get();
        const currentCategoryIds = courseData.categoryIds || [];
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            categoryIds: currentCategoryIds.filter((id) => id !== categoryId),
          },
          isDirty: true,
        });
      },

      setCategories: (categoryIds) => {
        const { saveToHistory, courseData } = get();
        saveToHistory();
        
        set({
          courseData: {
            ...courseData,
            categoryIds,
          },
          isDirty: true,
        });
      },

      // History
      saveToHistory: () => {
        const { courseData, history } = get();
        set({
          history: {
            past: [...history.past.slice(-19), courseData],
            future: [],
          },
        });
      },

      undo: () => {
        const { history, courseData } = get();
        if (history.past.length === 0) return;
        
        const previous = history.past[history.past.length - 1];
        const newPast = history.past.slice(0, -1);
        
        set({
          courseData: previous,
          history: {
            past: newPast,
            future: [courseData, ...history.future],
          },
        });
      },

      redo: () => {
        const { history, courseData } = get();
        if (history.future.length === 0) return;
        
        const next = history.future[0];
        const newFuture = history.future.slice(1);
        
        set({
          courseData: next,
          history: {
            past: [...history.past, courseData],
            future: newFuture,
          },
        });
      },

      // Validation
      validate: () => {
        const { courseData } = get();
        const errors: ValidationErrors = {};
        
        if (!courseData.title?.trim()) {
          errors.title = "Title is required";
        }
        
        if (!courseData.subTitle?.trim()) {
          errors.subTitle = "Subtitle is required";
        }
        
        if (!courseData.slug?.trim()) {
          errors.slug = "Slug is required";
        }
        
        if (!courseData.duration?.trim()) {
          errors.duration = "Duration is required";
        }
        
        if (courseData.learningOutcomes.length === 0) {
          errors.learningOutcomes = "At least one learning outcome is required";
        }
        
        const isValid = Object.keys(errors).length === 0;
        
        set({ errors, isValid });
        return isValid;
      },

      clearErrors: () => {
        set({ errors: {}, isValid: true });
      },

      // UI State
      setActiveSection: (section) => {
        set({ activeSection: section });
      },

      toggleThemePanel: () => {
        set((state) => ({ 
          isThemePanelOpen: !state.isThemePanelOpen,
          isEditPanelOpen: false,
        }));
      },

      togglePreviewFullscreen: () => {
        set((state) => ({ isPreviewFullscreen: !state.isPreviewFullscreen }));
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setSaving: (saving) => {
        set({ isSaving: saving });
      },

      // Full-screen editor actions
      setEditMode: (enabled) => {
        set({ isEditMode: enabled });
      },

      toggleEditMode: () => {
        set((state) => ({ isEditMode: !state.isEditMode }));
      },

      selectSection: (section) => {
        set({ selectedSection: section });
      },

      hoverSection: (section) => {
        set({ hoveredSection: section });
      },

      openEditPanel: (section) => {
        set({
          selectedSection: section,
          isEditPanelOpen: true,
          isThemePanelOpen: false,
        });
      },

      closeEditPanel: () => {
        set({
          isEditPanelOpen: false,
          selectedSection: null,
        });
      },

      closePanels: () => {
        set({
          isEditPanelOpen: false,
          isThemePanelOpen: false,
        });
      },

      // Export/Import
      exportCourse: () => {
        const { courseData } = get();
        return JSON.stringify(courseData, null, 2);
      },

      importCourse: (json) => {
        try {
          const data = JSON.parse(json) as CourseFormData;
          const normalizedData = {
            ...data,
            sections: data.sections.map((s) => normalizeSectionModules(s)),
          };
          const { saveToHistory } = get();
          saveToHistory();
          set({
            courseData: normalizedData,
            selectedThemeId: normalizedData.theme?.id || "ocean-blue",
            isDirty: true,
          });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: "lms-course-editor-store",
      partialize: (state) => ({
        courseData: state.courseData,
        selectedPageTemplate: state.selectedPageTemplate,
        selectedTemplateId: state.selectedTemplateId,
        selectedThemeId: state.selectedThemeId,
        isEditMode: state.isEditMode,
      }),
    }
  )
);
