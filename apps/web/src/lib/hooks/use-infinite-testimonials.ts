import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchTestimonialsList } from "@/lib/api/testimonials-list";

export const TESTIMONIALS_QUERY_KEY = ["testimonials", "approved", "infinite"] as const;
export const TESTIMONIALS_PAGE_SIZE = 12;

export function useInfiniteTestimonials(host: string | undefined) {
  return useInfiniteQuery({
    queryKey: [...TESTIMONIALS_QUERY_KEY, host ?? "client"],
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const result = await fetchTestimonialsList(
        { page, limit: TESTIMONIALS_PAGE_SIZE },
        host!
      );
      return {
        testimonials: result.testimonials,
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: result.page * result.limit < result.total,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: !!host,
    staleTime: 60 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
