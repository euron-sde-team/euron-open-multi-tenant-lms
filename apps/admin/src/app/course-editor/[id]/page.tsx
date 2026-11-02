"use client";

import { Button, cn } from "@open-mtlms/core";
import type { CourseFormData, ThemeConfig } from "@open-mtlms/shared";
import { getDefaultCourseFormData } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";

import { CourseEditorContainer } from "@/components/course-editor/CourseEditorContainer";
import { CourseEditorToolbar } from "@/components/course-editor/CourseEditorToolbar";
import { CourseThemePanel } from "@/components/course-editor/CourseThemePanel";
import { pagesApi } from "@/lib/api/pages";
import type { CoursePageTemplateId } from "@/lib/stores/course-store";
import { useCourseStore } from "@/lib/stores/course-store";
import { useTenantSettingsStore } from "@/lib/stores/tenant-settings-store";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { pageToPageConfig } from "@/lib/types/page";

// Map tenant template IDs to course store template IDs
// Only Modern template is supported
const templateIdMap: Record<string, CoursePageTemplateId> = {
  "course-modern": "modern",
  modern: "modern",
};

// Normalize theme to ensure it has the correct structure
const normalizeTheme = (theme: unknown): ThemeConfig => {
  if (!theme || typeof theme !== "object") return defaultThemeConfig;

  const t = theme as Record<string, unknown>;

  // Check if it's the old simplified format
  if ("colorScheme" in t || "primaryColor" in t || !("colors" in t)) {
    return defaultThemeConfig;
  }

  // Check for correct structure
  const hasCorrectStructure =
    t.colors &&
    typeof t.colors === "object" &&
    "light" in (t.colors as object) &&
    t.fonts &&
    typeof t.fonts === "object" &&
    t.spacing &&
    typeof t.spacing === "object" &&
    t.borders &&
    typeof t.borders === "object";

  if (!hasCorrectStructure) return defaultThemeConfig;

  return {
    ...defaultThemeConfig,
    ...t,
    colors: {
      light: {
        ...defaultThemeConfig.colors.light,
        ...((t.colors as { light?: object })?.light || {}),
      },
      dark: { ...defaultThemeConfig.colors.dark, ...((t.colors as { dark?: object })?.dark || {}) },
    },
    fonts: { ...defaultThemeConfig.fonts, ...((t.fonts as object) || {}) },
    spacing: { ...defaultThemeConfig.spacing, ...((t.spacing as object) || {}) },
    borders: { ...defaultThemeConfig.borders, ...((t.borders as object) || {}) },
  } as ThemeConfig;
};

// Convert global theme (ThemeConfig) to course theme format (CourseThemeConfig)
function convertToCourseTheme(globalTheme: ThemeConfig) {
  return {
    id: "global-theme",
    name: "Global Theme",
    description: "Theme from landing page",
    colors: {
      light: {
        primary: globalTheme.colors.light.primary,
        primaryForeground: globalTheme.colors.light.primaryForeground,
        secondary: globalTheme.colors.light.secondary,
        secondaryForeground: globalTheme.colors.light.secondaryForeground,
        accent: globalTheme.colors.light.accent,
        accentForeground: globalTheme.colors.light.accentForeground,
        background: globalTheme.colors.light.background,
        foreground: globalTheme.colors.light.foreground,
        muted: globalTheme.colors.light.muted,
        mutedForeground: globalTheme.colors.light.mutedForeground,
        card: globalTheme.colors.light.card,
        cardForeground: globalTheme.colors.light.cardForeground,
        border: globalTheme.colors.light.border,
        input: globalTheme.colors.light.input,
        ring: globalTheme.colors.light.ring,
      },
      dark: {
        background: globalTheme.colors.dark.background,
        foreground: globalTheme.colors.dark.foreground,
        card: globalTheme.colors.dark.card,
        cardForeground: globalTheme.colors.dark.cardForeground,
        muted: globalTheme.colors.dark.muted,
        mutedForeground: globalTheme.colors.dark.mutedForeground,
        border: globalTheme.colors.dark.border,
        input: globalTheme.colors.dark.input,
      },
    },
    fonts: {
      heading: globalTheme.fonts.heading,
      body: globalTheme.fonts.body,
      headingWeight: globalTheme.fonts.headingWeight,
      bodyWeight: globalTheme.fonts.bodyWeight,
    },
    borderRadius: globalTheme.borders.radius,
  };
}

// Mock function to fetch course by ID - replace with actual API call
async function fetchCourse(id: string): Promise<CourseFormData | null> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Mock data - in real implementation, this would be an API call
  const mockCourses: Record<string, Partial<CourseFormData>> = {
    "1": {
      id: "1",
      title: "Complete Python Masterclass",
      subTitle: "From beginner to expert in Python programming",
      slug: "complete-python-masterclass",
      description:
        "Learn Python from scratch with practical examples. This comprehensive course covers everything from basic syntax to advanced concepts like decorators, generators, and async programming.\n\nYou'll build real projects including web scrapers, automation scripts, and data analysis tools.",
      duration: "40 hours",
      mode: "SELF_PACED",
      type: "NORMAL",
      purchaseMode: "PAID",
      status: "PUBLISHED",
      language: "English",
      weight: 0,
      isYoungCourse: false,
      individualPricing: true,
      webPriceINR: 4999,
      mobilePriceINR: 3999,
      webPriceUSD: 59,
      mobilePriceUSD: 49,
      webDiscount: 20,
      mobileDiscount: 0,
      webThumbnailUrl: "",
      mobileThumbnailUrl: "",
      previewUrl: "",
      learningOutcomes: [
        "Master Python fundamentals",
        "Build real-world applications",
        "Work with data structures",
        "Learn object-oriented programming",
        "Handle files and databases",
        "Create web scrapers and automation scripts",
      ],
      prerequisites: ["Basic computer skills", "No programming experience required"],
      sections: [
        {
          id: "sec-1",
          title: "Getting Started with Python",
          order: 0,
          modules: [
            {
              id: "mod-1",
              title: "Welcome to the Course",
              order: 0,
              lectures: [
                { id: "lec-1", title: "Welcome to the Course", order: 0, duration: "5:00" },
              ],
            },
            {
              id: "mod-2",
              title: "Installing Python",
              order: 1,
              lectures: [{ id: "lec-2", title: "Installing Python", order: 1, duration: "10:00" }],
            },
            {
              id: "mod-3",
              title: "Your First Python Program",
              order: 2,
              lectures: [
                { id: "lec-3", title: "Your First Python Program", order: 2, duration: "15:00" },
              ],
            },
          ],
        },
        {
          id: "sec-2",
          title: "Python Fundamentals",
          order: 1,
          modules: [
            {
              id: "mod-4",
              title: "Variables and Data Types",
              order: 0,
              lectures: [
                { id: "lec-4", title: "Variables and Data Types", order: 0, duration: "20:00" },
              ],
            },
            {
              id: "mod-5",
              title: "Operators",
              order: 1,
              lectures: [{ id: "lec-5", title: "Operators", order: 1, duration: "15:00" }],
            },
            {
              id: "mod-6",
              title: "Control Flow",
              order: 2,
              lectures: [{ id: "lec-6", title: "Control Flow", order: 2, duration: "25:00" }],
            },
          ],
        },
        {
          id: "sec-3",
          title: "Functions and Modules",
          order: 2,
          modules: [
            {
              id: "mod-7",
              title: "Defining Functions",
              order: 0,
              lectures: [{ id: "lec-7", title: "Defining Functions", order: 0, duration: "20:00" }],
            },
            {
              id: "mod-8",
              title: "Function Arguments",
              order: 1,
              lectures: [{ id: "lec-8", title: "Function Arguments", order: 1, duration: "15:00" }],
            },
            {
              id: "mod-9",
              title: "Working with Modules",
              order: 2,
              lectures: [
                { id: "lec-9", title: "Working with Modules", order: 2, duration: "18:00" },
              ],
            },
          ],
        },
      ],
      offerings: [
        { id: "off-1", icon: "video", text: "40 hours of video content" },
        { id: "off-2", icon: "download", text: "Downloadable resources" },
        { id: "off-3", icon: "award", text: "Certificate of completion" },
        { id: "off-4", icon: "users", text: "Community access" },
      ],
      faqs: [
        {
          id: "faq-1",
          question: "Do I need prior programming experience?",
          answer:
            "No, this course is designed for complete beginners. We start from the very basics and gradually build up to more advanced concepts.",
        },
        {
          id: "faq-2",
          question: "How long do I have access to the course?",
          answer:
            "You get lifetime access to all course materials, including any future updates we make to the content.",
        },
        {
          id: "faq-3",
          question: "Is there a money-back guarantee?",
          answer:
            "Yes, we offer a 30-day money-back guarantee. If you're not satisfied with the course, you can request a full refund.",
        },
      ],
      recommendations: [],
      instructorIds: ["mentor-1", "mentor-2"],
      categoryIds: [],
    },
    "2": {
      id: "2",
      title: "Data Science Bootcamp",
      subTitle: "8-week intensive course with hands-on projects",
      slug: "data-science-bootcamp",
      description:
        "8-week intensive course with hands-on projects. Learn data science with guided lessons and real-world projects.",
      duration: "8 weeks",
      mode: "SELF_PACED",
      type: "NORMAL",
      purchaseMode: "PAID",
      status: "PUBLISHED",
      language: "English",
      weight: 0,
      isYoungCourse: false,
      individualPricing: true,
      webPriceINR: 14999,
      mobilePriceINR: 11999,
      webPriceUSD: 199,
      mobilePriceUSD: 149,
      webDiscount: 0,
      mobileDiscount: 0,
      webThumbnailUrl: "",
      mobileThumbnailUrl: "",
      previewUrl: "",
      learningOutcomes: ["Guided lessons", "Hands-on projects", "Data science fundamentals"],
      prerequisites: ["Basic programming"],
      sections: [
        {
          id: "sec-1",
          title: "Introduction",
          order: 0,
          modules: [
            {
              id: "mod-1",
              title: "Welcome",
              order: 0,
              lectures: [{ id: "lec-1", title: "Welcome", order: 0, duration: "10:00" }],
            },
          ],
        },
      ],
      offerings: [
        { id: "off-1", icon: "video", text: "Video lessons" },
        { id: "off-2", icon: "award", text: "Certificate" },
      ],
      faqs: [{ id: "faq-1", question: "How long do I have access?", answer: "One year from purchase." }],
      recommendations: [],
      instructorIds: ["mentor-1"],
      categoryIds: [],
    },
    "3": {
      id: "3",
      title: "Web Development Course",
      subTitle: "Self-paced learning with weekly projects",
      slug: "web-development",
      description: "Self-paced learning with weekly projects. Build modern web apps.",
      duration: "6 weeks",
      mode: "SELF_PACED",
      type: "NORMAL",
      purchaseMode: "PAID",
      status: "DRAFT",
      language: "English",
      weight: 0,
      isYoungCourse: false,
      individualPricing: true,
      webPriceINR: 9999,
      mobilePriceINR: 7999,
      webPriceUSD: 129,
      mobilePriceUSD: 99,
      webDiscount: 0,
      mobileDiscount: 0,
      webThumbnailUrl: "",
      mobileThumbnailUrl: "",
      previewUrl: "",
      learningOutcomes: ["HTML, CSS, JavaScript", "React basics", "Project reviews"],
      prerequisites: ["None"],
      sections: [
        {
          id: "sec-1",
          title: "Getting Started",
          order: 0,
          modules: [
            {
              id: "mod-1",
              title: "Intro",
              order: 0,
              lectures: [{ id: "lec-1", title: "Intro", order: 0, duration: "15:00" }],
            },
          ],
        },
      ],
      offerings: [
        { id: "off-1", icon: "video", text: "Video content" },
        { id: "off-2", icon: "users", text: "Weekly Q&A" },
      ],
      faqs: [
        { id: "faq-1", question: "Is it self-paced?", answer: "Yes, learn on your own schedule." },
      ],
      recommendations: [],
      instructorIds: ["mentor-1"],
      categoryIds: [],
    },
    "4": {
      id: "4",
      title: "Machine Learning Fundamentals",
      subTitle: "Learn ML concepts from scratch with practical examples",
      slug: "machine-learning-fundamentals",
      description:
        "Learn ML concepts from scratch with practical examples. From basics to real projects.",
      duration: "30 hours",
      mode: "SELF_PACED",
      type: "NORMAL",
      purchaseMode: "PAID",
      status: "NOT_PUBLISHED",
      language: "Hindi",
      weight: 0,
      isYoungCourse: false,
      individualPricing: true,
      webPriceINR: 3999,
      mobilePriceINR: 2999,
      webPriceUSD: 49,
      mobilePriceUSD: 39,
      webDiscount: 0,
      mobileDiscount: 0,
      webThumbnailUrl: "",
      mobileThumbnailUrl: "",
      previewUrl: "",
      learningOutcomes: ["ML basics", "Practical examples", "Projects"],
      prerequisites: ["Python basics"],
      sections: [
        {
          id: "sec-1",
          title: "Introduction to ML",
          order: 0,
          modules: [
            {
              id: "mod-1",
              title: "Overview",
              order: 0,
              lectures: [{ id: "lec-1", title: "Overview", order: 0, duration: "20:00" }],
            },
          ],
        },
      ],
      offerings: [
        { id: "off-1", icon: "video", text: "30 hours video" },
        { id: "off-2", icon: "award", text: "Certificate" },
      ],
      faqs: [{ id: "faq-1", question: "Language?", answer: "Course is in Hindi." }],
      recommendations: [],
      instructorIds: ["mentor-1"],
      categoryIds: [],
    },
  };

  // Handle "new" course
  if (id === "new") {
    return null;
  }

  const course = mockCourses[id];
  if (!course) return null;

  // Return with default theme
  return {
    ...course,
    theme: {
      id: "ocean-blue",
      name: "Ocean Blue",
      description: "Professional, tech-focused theme",
      colors: {
        light: {
          primary: "199 89% 48%",
          primaryForeground: "0 0% 100%",
          secondary: "215 20% 65%",
          secondaryForeground: "222 47% 11%",
          accent: "199 89% 48%",
          accentForeground: "0 0% 100%",
          background: "0 0% 100%",
          foreground: "222 47% 11%",
          muted: "210 40% 96%",
          mutedForeground: "215 16% 47%",
          card: "0 0% 100%",
          cardForeground: "222 47% 11%",
          border: "214 32% 91%",
          input: "214 32% 91%",
          ring: "199 89% 48%",
        },
        dark: {
          background: "222 47% 11%",
          foreground: "210 40% 98%",
          card: "222 47% 14%",
          cardForeground: "210 40% 98%",
          muted: "217 33% 17%",
          mutedForeground: "215 20% 65%",
          border: "217 33% 17%",
          input: "217 33% 17%",
        },
      },
      fonts: {
        heading: "Inter",
        body: "Inter",
        headingWeight: "700",
        bodyWeight: "400",
      },
      borderRadius: "0.5rem",
    },
  } as CourseFormData;
}

export default function CourseEditorPage() {
  const params = useParams();
  const courseId = (params?.id as string) ?? "";

  const {
    loadCourse,
    setLoading,
    isThemePanelOpen,
    validate,
    courseData,
    setEditMode,
    setPageTemplate,
  } = useCourseStore();

  const { selectedTenantId } = useTenantStore();
  const { getCoursePageTemplateId } = useTenantSettingsStore();

  const [notFound, setNotFound] = useState(false);
  const [globalTheme, setGlobalTheme] = useState<ThemeConfig | null>(null);
  const themeLoadedRef = useRef(false);

  // Apply tenant's selected course page template
  useEffect(() => {
    if (selectedTenantId) {
      const tenantTemplateId = getCoursePageTemplateId(selectedTenantId);
      if (tenantTemplateId && templateIdMap[tenantTemplateId]) {
        setPageTemplate(templateIdMap[tenantTemplateId]);
      }
    }
  }, [selectedTenantId, getCoursePageTemplateId, setPageTemplate]);

  // Fetch global theme from homepage
  useEffect(() => {
    async function loadGlobalTheme() {
      if (!selectedTenantId || themeLoadedRef.current) return;

      try {
        const homepage = await pagesApi.getHomepage(selectedTenantId);

        if (homepage) {
          const pageConfig = pageToPageConfig(homepage);

          if (pageConfig.theme) {
            const normalizedTheme = normalizeTheme(pageConfig.theme);
            setGlobalTheme(normalizedTheme);
            themeLoadedRef.current = true;
          }
        }
      } catch (error) {
        console.error("Failed to load global theme:", error);
      }
    }

    loadGlobalTheme();
  }, [selectedTenantId]);

  // Load course data or initialize new course (mirrors landing page: explicit default config for "new")
  useEffect(() => {
    setEditMode(true);

    if (courseId === "new") {
      setLoading(true);
      // Explicitly set default course data so create page shows dummy content
      const defaultData = getDefaultCourseFormData();

      // Apply global theme if available
      if (globalTheme) {
        const courseTheme = convertToCourseTheme(globalTheme);
        loadCourse({ ...defaultData, theme: courseTheme });
      } else {
        loadCourse(defaultData);
      }
      setLoading(false);

      // Re-apply default data after persist rehydration so we don't get overwritten by old persisted empty state
      const unsub = useCourseStore.persist.onFinishHydration(() => {
        const freshData = getDefaultCourseFormData();
        if (globalTheme) {
          const courseTheme = convertToCourseTheme(globalTheme);
          loadCourse({ ...freshData, theme: courseTheme });
        } else {
          loadCourse(freshData);
        }
      });
      return () => {
        if (typeof unsub === "function") unsub();
      };
    }

    async function loadExisting() {
      setLoading(true);
      try {
        const data = await fetchCourse(courseId);
        if (data) {
          // Apply global theme if available (override course's saved theme)
          if (globalTheme) {
            const courseTheme = convertToCourseTheme(globalTheme);
            loadCourse({ ...data, theme: courseTheme });
          } else {
            loadCourse(data);
          }
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.error("Failed to load course:", error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadExisting();
  }, [courseId, loadCourse, setLoading, setEditMode, globalTheme]);

  const handleSaveDraft = () => {
    // TODO: Implement save draft API call
    console.log("Saving draft:", courseData);
    alert("Draft saved! (API integration pending)");
  };

  const handlePublish = () => {
    if (validate()) {
      // TODO: Implement publish API call
      console.log("Publishing course:", courseData);
      alert("Course published! (API integration pending)");
    } else {
      alert("Please fix validation errors before publishing.");
    }
  };

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold">Course Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The course you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button asChild>
            <Link href="/dashboard/courses">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Courses
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/30 min-h-screen">
      {/* Fixed Toolbar */}
      <CourseEditorToolbar onSaveDraft={handleSaveDraft} onPublish={handlePublish} />

      {/* Main editor layout - offset by toolbar height */}
      <div className="flex pt-14">
        {/* Center - Preview Area */}
        <main
          className={cn(
            "min-h-[calc(100vh-3.5rem)] flex-1 overflow-auto transition-all duration-300",
            isThemePanelOpen && "md:mr-80 lg:mr-96"
          )}
        >
          <div className="min-h-full">
            <CourseEditorContainer />
          </div>
        </main>

        {/* Right Panel - Theme Panel (slides in) */}
        <CourseThemePanel />
      </div>
    </div>
  );
}
