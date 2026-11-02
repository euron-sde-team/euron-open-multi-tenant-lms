"use client";

import { Button } from "@open-mtlms/core";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";

import { QuizConfigPanel } from "@/components/lms-editor";
import { coursesLmsApi } from "@/lib/api/courses-lms";
import { pagesApi } from "@/lib/api/pages";
import { quizzesApi } from "@/lib/api/quizzes";
import { extractCourseSlug } from "@/lib/utils/slug";

/**
 * Dedicated full-page quiz editor (replaces the old cramped quiz-config modal).
 * `[id]` is the tenant_pages page id (same as the curriculum editor route); the
 * real LMS course id is resolved via the page slug. Hosting the panel on a page
 * also un-nests the bank/library import pickers (page -> modal, not modal-on-modal).
 */
export default function QuizEditorPage() {
  const params = useParams<{ id: string; quizId: string }>();
  const router = useRouter();
  const pageId = (params?.id as string) ?? "";
  const quizId = (params?.quizId as string) ?? "";

  const curriculumHref = `/dashboard/courses/${pageId}/lms/editor`;
  const backToCurriculum = useCallback(() => {
    router.push(curriculumHref);
  }, [router, curriculumHref]);

  // Resolve the real LMS course id from the page slug (mirrors the curriculum
  // editor's resolveLmsCourseId). All quiz/question APIs are course-scoped.
  const {
    data: lmsCourseId,
    isLoading: resolving,
    isError: resolveError,
  } = useQuery({
    queryKey: ["lms-course-id-for-page", pageId],
    queryFn: async () => {
      const page = await pagesApi.getPage(pageId);
      const slug = extractCourseSlug(page.slug);
      const course = slug ? await coursesLmsApi.getCourseBySlug(slug) : null;
      if (!course) throw new Error("Course not found for this page");
      return course.id;
    },
    enabled: !!pageId,
  });

  // Quiz metadata for the breadcrumb + lesson-title sync (lesson_id).
  const { data: quiz } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => quizzesApi.get(quizId),
    enabled: !!quizId,
  });

  // Keep the curriculum lesson title in sync with the quiz title (parity with
  // the old modal). Fires on Save; persisted server-side via the quiz's lesson_id.
  const syncLessonTitle = useCallback(
    async (title: string) => {
      if (!lmsCourseId || !quiz?.lesson_id) return;
      try {
        await coursesLmsApi.updateLesson(lmsCourseId, quiz.lesson_id, { title });
      } catch {
        // Non-fatal: the quiz title itself is already saved by the panel.
      }
    },
    [lmsCourseId, quiz?.lesson_id],
  );

  if (resolving) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (resolveError || !lmsCourseId) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-4xl flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Could not load this quiz. The course may have been moved or deleted.
        </p>
        <Button variant="outline" size="sm" onClick={backToCurriculum}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to curriculum
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <button
          type="button"
          onClick={backToCurriculum}
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to curriculum
        </button>
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href={curriculumHref} className="hover:text-foreground">
            Curriculum
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="max-w-[240px] truncate font-medium text-foreground">
            {quiz?.title || "Quiz"}
          </span>
        </nav>
        <h1 className="mt-2 text-2xl font-bold">Quiz editor</h1>
      </div>

      <QuizConfigPanel
        quizId={quizId}
        courseId={lmsCourseId}
        onTitleChange={syncLessonTitle}
        onDone={backToCurriculum}
      />
    </div>
  );
}
