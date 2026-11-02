import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";

import {
  questionLibraryApi,
  type ListCoursesFilters,
  type QuestionCourseStatus,
} from "../api/question-library";

export const questionLibraryKeys = {
  all: ["question-library"] as const,
  courses: (filters: ListCoursesFilters) =>
    [...questionLibraryKeys.all, "courses", filters] as const,
  courseTree: (courseId: string) =>
    [...questionLibraryKeys.all, "course-tree", courseId] as const,
  search: (query: string) =>
    [...questionLibraryKeys.all, "search", query] as const,
};

export function useQuestionLibraryCourses(
  filters: {
    search?: string;
    status?: QuestionCourseStatus;
    limit?: number;
    offset?: number;
    enabled?: boolean;
  } = {}
) {
  const { enabled = true, ...listFilters } = filters;
  return useQuery({
    queryKey: questionLibraryKeys.courses(listFilters),
    queryFn: () => questionLibraryApi.listCourses(listFilters),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useQuestionLibraryCourseTree(courseId: string | null) {
  return useQuery({
    queryKey: questionLibraryKeys.courseTree(courseId ?? ""),
    queryFn: () => questionLibraryApi.getCourseTree(courseId as string),
    enabled: !!courseId,
    staleTime: 60_000,
  });
}

export function useQuestionLibrarySearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: questionLibraryKeys.search(q),
    queryFn: () => questionLibraryApi.search(q),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}

/**
 * Copy the (already edited) selected questions into the destination quiz.
 * On success, invalidate that quiz's question list so the editor refreshes,
 * plus the library lists (per-course question counts may have changed).
 */
export function useImportQuestions(courseId: string, quizId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: questionLibraryApi.importQuestions,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["quiz-questions", courseId, quizId],
      });
      queryClient.invalidateQueries({ queryKey: questionLibraryKeys.all });
    },
  });
}
