import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  coursesLmsApi,
  type CreateLessonResourceRequest,
  type LessonResource,
  type UpdateLessonResourceRequest,
} from "../api/courses-lms";

import { availableRoutesKeys } from "./use-available-routes";
import { entitlementKeys } from "./use-entitlements";

export const lmsCourseKeys = {
  all: ["lms-courses"] as const,
  lists: () => [...lmsCourseKeys.all, "list"] as const,
  list: (params?: Record<string, unknown>) =>
    [...lmsCourseKeys.lists(), params ?? ""] as const,
  details: () => [...lmsCourseKeys.all, "detail"] as const,
  detail: (courseId: string) => [...lmsCourseKeys.details(), courseId] as const,
  sections: (courseId: string) =>
    [...lmsCourseKeys.detail(courseId), "sections"] as const,
  sectionLessons: (courseId: string, sectionId: string) =>
    [...lmsCourseKeys.detail(courseId), "section", sectionId, "lessons"] as const,
  lesson: (courseId: string, lessonId: string) =>
    [...lmsCourseKeys.detail(courseId), "lesson", lessonId] as const,
  lecture: (courseId: string, lessonId: string) =>
    [...lmsCourseKeys.lesson(courseId, lessonId), "lecture"] as const,
  lessonResources: (courseId: string, lessonId: string) =>
    [...lmsCourseKeys.lesson(courseId, lessonId), "resources"] as const,
  quiz: (courseId: string, lessonId: string) =>
    [...lmsCourseKeys.lesson(courseId, lessonId), "quiz"] as const,
  quizQuestions: (courseId: string, quizId: string) =>
    [...lmsCourseKeys.detail(courseId), "quiz", quizId, "questions"] as const,
  assignment: (courseId: string, lessonId: string) =>
    [...lmsCourseKeys.lesson(courseId, lessonId), "assignment"] as const,
};

export function useLMSCourses(params?: {
  page?: number;
  limit?: number;
  status?: string;
  mode?: string;
}) {
  return useQuery({
    queryKey: lmsCourseKeys.list(params),
    queryFn: () => coursesLmsApi.getCourses(params),
  });
}

export function useLMSCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: lmsCourseKeys.detail(courseId ?? ""),
    queryFn: () => coursesLmsApi.getCourse(courseId!),
    enabled: !!courseId,
  });
}

export function useCourseSections(courseId: string | undefined) {
  return useQuery({
    queryKey: lmsCourseKeys.sections(courseId ?? ""),
    queryFn: () => coursesLmsApi.getSections(courseId!),
    enabled: !!courseId,
  });
}

export function useSectionLessons(
  courseId: string | undefined,
  sectionId: string | undefined
) {
  return useQuery({
    queryKey: lmsCourseKeys.sectionLessons(courseId ?? "", sectionId ?? ""),
    queryFn: () => coursesLmsApi.getLessons(courseId!, sectionId!),
    enabled: !!courseId && !!sectionId,
  });
}

// ── Structured lesson resources ──

export function useLessonResources(
  courseId: string | null | undefined,
  lessonId: string | null | undefined
) {
  return useQuery({
    queryKey: lmsCourseKeys.lessonResources(courseId ?? "", lessonId ?? ""),
    queryFn: () => coursesLmsApi.getLessonResources(courseId!, lessonId!),
    enabled: !!courseId && !!lessonId,
  });
}

export function useCreateLessonResource(courseId: string, lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLessonResourceRequest) =>
      coursesLmsApi.createLessonResource(courseId, lessonId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: lmsCourseKeys.lessonResources(courseId, lessonId),
      });
    },
  });
}

export function useUpdateLessonResource(courseId: string, lessonId: string) {
  const queryClient = useQueryClient();
  const queryKey = lmsCourseKeys.lessonResources(courseId, lessonId);
  return useMutation({
    mutationFn: ({
      resourceId,
      data,
    }: {
      resourceId: string;
      data: UpdateLessonResourceRequest;
    }) => coursesLmsApi.updateLessonResource(courseId, lessonId, resourceId, data),
    // Optimistic update, the Downloadable switch (and inline edits) must
    // respond instantly instead of waiting for the PATCH + refetch round trip.
    onMutate: async ({ resourceId, data }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<LessonResource[]>(queryKey);
      queryClient.setQueryData<LessonResource[]>(queryKey, (old) =>
        old?.map((r) => (r.id === resourceId ? { ...r, ...data } : r))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useDeleteLessonResource(courseId: string, lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resourceId: string) =>
      coursesLmsApi.deleteLessonResource(courseId, lessonId, resourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: lmsCourseKeys.lessonResources(courseId, lessonId),
      });
    },
  });
}

/** Import quiz questions from a CSV file (FormData upload) */
export function useImportQuizQuestionsCsv(courseId: string, quizId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      coursesLmsApi.importQuizQuestionsCsv(courseId, quizId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: lmsCourseKeys.quizQuestions(courseId, quizId),
      });
    },
  });
}

export function useCreateLMSCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; slug: string; mode?: string }) =>
      coursesLmsApi.createCourse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lmsCourseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
    },
  });
}

export function useDeleteLMSCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => coursesLmsApi.deleteCourse(courseId),
    onSuccess: (_, courseId) => {
      queryClient.invalidateQueries({ queryKey: lmsCourseKeys.detail(courseId) });
      queryClient.invalidateQueries({ queryKey: lmsCourseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
    },
  });
}

export function useCreateSection(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; sort_order?: number }) =>
      coursesLmsApi.createSection(courseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lmsCourseKeys.sections(courseId) });
    },
  });
}

export function useCreateLesson(
  courseId: string,
  sectionId: string
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      type: "LECTURE" | "QUIZ" | "ASSIGNMENT";
      sort_order?: number;
      is_preview?: boolean;
    }) => coursesLmsApi.createLesson(courseId, sectionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: lmsCourseKeys.sectionLessons(courseId, sectionId),
      });
    },
  });
}
