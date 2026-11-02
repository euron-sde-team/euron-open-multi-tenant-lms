/**
 * Server-side prefetch for testimonials listing.
 */

import { QueryClient, dehydrate } from "@tanstack/react-query";
import { fetchTestimonialsList } from "@/lib/api/testimonials-list";
import {
  TESTIMONIALS_QUERY_KEY,
  TESTIMONIALS_PAGE_SIZE,
} from "@/lib/hooks/use-infinite-testimonials";

export async function prefetchTestimonials(tenantHost: string) {
  const queryClient = new QueryClient();

  await queryClient
    .prefetchInfiniteQuery({
      queryKey: [...TESTIMONIALS_QUERY_KEY, tenantHost],
      queryFn: async ({ pageParam }) => {
        const page = pageParam as number;
        const result = await fetchTestimonialsList(
          { page, limit: TESTIMONIALS_PAGE_SIZE },
          tenantHost
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
    })
    .catch((err) => {
      console.warn("[prefetch-testimonials] Failed to prefetch:", err);
    });

  return dehydrate(queryClient);
}
