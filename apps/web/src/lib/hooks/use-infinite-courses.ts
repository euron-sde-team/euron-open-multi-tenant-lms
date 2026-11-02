import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchCourseList } from "@/lib/api";
import type { CourseMode } from "@/lib/api";
import { useUserAuthStore } from "@/lib/stores/auth-store";

export const COURSES_QUERY_KEY = ["courses", "published", "infinite"] as const;
export const COURSES_PAGE_SIZE = 24;

export type CourseFilter = CourseMode | "all" | "bookmarked";

export function useInfiniteCourses(
  host: string | undefined,
  filter?: CourseFilter
) {
  const { isAuthenticated } = useUserAuthStore();
  const isBookmarked = filter === "bookmarked";
  const mode = filter === "all" ? undefined : (filter as CourseMode);
  const courseType = "NORMAL" as const;

  return useInfiniteQuery({
    queryKey: [...COURSES_QUERY_KEY, host ?? "client", filter ?? "all", isAuthenticated],
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const result = await fetchCourseList(
        {
          mode: isBookmarked ? undefined : mode,
          page,
          limit: COURSES_PAGE_SIZE,
          courseType: isBookmarked ? undefined : courseType,
          bookmarkedOnly: isBookmarked,
        },
        host!
      );
      return {
        courses: result.courses,
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: result.page * result.limit < result.total,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: !!host && (!isBookmarked || isAuthenticated),
    staleTime: 60 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
