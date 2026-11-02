"use client";

import { Button } from "@open-mtlms/core";
import type { LMSCourseData, LMSSection, LMSSettings } from "@open-mtlms/shared";
import {
  DEFAULT_LMS_SETTINGS,
  createLMSLesson,
  createLMSSection,
} from "@open-mtlms/shared";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { coursesLmsApi } from "@/lib/api/courses-lms";
import { pagesApi } from "@/lib/api/pages";
import { useLMSStore } from "@/lib/stores/lms-store";
import { useTenantStore } from "@/lib/stores/tenant-store";
import {
  lmsFullToCourseFormData,
  pageToCourseFormData,
} from "@/lib/utils/course-converter";
import {
  lmsFullToLmsStoreData,
  apiSectionToStoreSectionSingle,
  apiLessonWithLectureToStoreLesson,
  videoKeyToConfig,
} from "@/lib/utils/lms-mapper";
import { extractCourseSlug } from "@/lib/utils/slug";

export default function LMSTemplateSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = (params?.id as string) ?? "";

  const { selectedTenantId } = useTenantStore();
  const { loadLMS } = useLMSStore();

  const [_isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  // Load course data and auto-navigate to editor with classic template
  useEffect(() => {
    async function loadData() {
      if (!selectedTenantId || !courseId || hasInitialized.current) {
        if (!selectedTenantId) {
          setLoadError("Please select a tenant first");
          setIsLoading(false);
        }
        return;
      }

      hasInitialized.current = true;
      setIsLoading(true);
      setLoadError(null);

      try {
        // 1. Load the page (for slug, theme, fallback content)
        const coursePage = await pagesApi.getPage(courseId);
        const courseSlug = extractCourseSlug(coursePage.slug);

        // 2. Try to find the LMS course by slug
        const lmsCourse = courseSlug
          ? await coursesLmsApi.getCourseBySlug(courseSlug)
          : null;

        if (lmsCourse) {
          // LMS course exists, load full tree from DB
          const full = await coursesLmsApi.getCourseFull(lmsCourse.id);
          const courseFormData = lmsFullToCourseFormData(
            full,
            { id: coursePage.id, tenantId: coursePage.tenantId, slug: coursePage.slug },
            coursePage.theme
          );

          // Determine template based on course type
          const templateId = "classic" as const;

          // Resolve settings from DB. Merge OVER the defaults, never replace:
          // lms_settings can be a partial column (e.g. only syllabusAutoSync or
          // mobileOnlyPlayback), and replacing dropped enableCertificate et al.,
          // which then persisted on save and hid the student "Get Certificate"
          // button. Merging under defaults also keeps newer settings defined for
          // older courses.
          const dbSettings: LMSSettings = {
            ...DEFAULT_LMS_SETTINGS,
            ...((full.course?.lmsSettings as Partial<LMSSettings> | null) || {}),
          };

          if (full.sections && full.sections.length > 0) {
            // Has LMS content, load and go straight to editor
            const lmsData = lmsFullToLmsStoreData(full, courseFormData, templateId, dbSettings);
            loadLMS(lmsData);
            router.replace(`/dashboard/courses/${courseId}/lms/editor`);
            return;
          }

          // LMS course exists but no sections, create defaults in DB and go to editor
          const createdSection = await coursesLmsApi.createSection(lmsCourse.id, {
            title: "Getting Started",
            sort_order: 0,
          });
          const createdLesson = await coursesLmsApi.createLesson(lmsCourse.id, createdSection.id, {
            title: "Welcome",
            type: "LECTURE",
            sort_order: 0,
            is_preview: false,
          });
          const createdLecture = await coursesLmsApi.createLecture(lmsCourse.id, createdLesson.id, {
            title: "Welcome",
            duration: null,
            resource_links: [],
          });

          const mappedSection = apiSectionToStoreSectionSingle(createdSection, 0);
          const mappedLesson = apiLessonWithLectureToStoreLesson(createdLesson, createdLecture, 0);
          mappedSection.lessons = [mappedLesson];

          const lmsData: LMSCourseData = {
            course: courseFormData,
            sections: [mappedSection],
            templateId,
            settings: dbSettings,
          };
          loadLMS(lmsData);
        } else {
          // No LMS course, use page data or defaults
          const courseFormData = pageToCourseFormData(coursePage);

          const lmsSections: LMSSection[] = courseFormData.sections.map((section, sIndex) => {
            const norm = section.modules && section.modules.length > 0
              ? section
              : section.subtopics
                ? { ...section, modules: [{ id: `m-${section.id}`, title: "Content", order: 0, lectures: section.subtopics }] }
                : { ...section, modules: [] };
            const allLectures = norm.modules.flatMap((m) => m.lectures);
            return {
              id: section.id,
              title: section.title,
              order: sIndex,
              lessons: allLectures.map((topic, tIndex) => ({
              id: topic.id,
              title: topic.title,
              order: tIndex,
              duration: topic.duration,
              description: topic.description,
              resources: [],
              video: videoKeyToConfig(topic.videoUrl),
              })),
              resources: [],
            };
          });

          if (lmsSections.length === 0) {
            const defaultSection = createLMSSection("Getting Started", 0);
            defaultSection.lessons = [createLMSLesson("Welcome", 0)];
            lmsSections.push(defaultSection);
          }

          const lmsData: LMSCourseData = {
            course: courseFormData,
            sections: lmsSections,
            templateId: "classic",
            settings: DEFAULT_LMS_SETTINGS,
          };
          loadLMS(lmsData);
        }

        // Auto-navigate to editor
        router.replace(`/dashboard/courses/${courseId}/lms/editor`);
      } catch (error) {
        console.error("Failed to load course:", error);
        setLoadError("Failed to load course. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [selectedTenantId, courseId, loadLMS, router]);

  useEffect(() => {
    hasInitialized.current = false;
  }, [courseId]);

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p className="text-destructive mb-4">{loadError}</p>
        <Button asChild>
          <Link href="/dashboard/courses">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Courses
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <Loader2 className="text-primary mb-4 h-8 w-8 animate-spin" />
      <p className="text-muted-foreground">Loading course...</p>
    </div>
  );
}
