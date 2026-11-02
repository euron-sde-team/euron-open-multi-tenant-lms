/**
 * Server-side prefetch for courses listing.
 * Prefetches the listing modes (All, Self-Paced) so tab switching is instant.
 */

import { QueryClient, dehydrate } from "@tanstack/react-query";
import { fetchCourseList } from "@/lib/api";
import {
  COURSES_QUERY_KEY,
  COURSES_PAGE_SIZE,
  type CourseFilter,
} from "@/lib/hooks/use-infinite-courses";

const MODES_TO_PREFETCH: CourseFilter[] = [
  "all",
  "SELF_PACED",
];

async function prefetchFilter(
  queryClient: QueryClient,
  tenantHost: string,
  filter: CourseFilter
) {
  const isBookmarked = filter === "bookmarked";
  const mode = isBookmarked || filter === "all" ? undefined : filter;
  const courseType = "NORMAL" as const;

  // Match client query key: [...COURSES_QUERY_KEY, host, filter, isAuthenticated]
  // Server prefetches unauthenticated (isAuthenticated: false), auth'd users will refetch
  await queryClient.prefetchInfiniteQuery({
    queryKey: [...COURSES_QUERY_KEY, tenantHost, filter, false],
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const result = await fetchCourseList(
        {
          mode,
          page,
          limit: COURSES_PAGE_SIZE,
          courseType,
        },
        tenantHost
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
  });
}

export async function prefetchCourses(tenantHost: string) {
  const queryClient = new QueryClient();

  await Promise.all(
    MODES_TO_PREFETCH.map((filter) =>
      prefetchFilter(queryClient, tenantHost, filter).catch((err) => {
        console.warn(`[prefetch-courses] Failed to prefetch ${filter}:`, err);
      })
    )
  );

  return dehydrate(queryClient);
}
