/**
 * Server-side prefetch for bundles listing.
 * Fetches the first page on the server so the client has immediate data.
 */

import {
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { fetchPublishedBundles } from "@/lib/api/bundles";
import {
  BUNDLES_QUERY_KEY,
  BUNDLES_PAGE_SIZE,
} from "@/lib/hooks/use-infinite-published-bundles";

export async function prefetchBundles(tenantHost: string) {
  const queryClient = new QueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: BUNDLES_QUERY_KEY,
    queryFn: async ({ pageParam }) => {
      const result = await fetchPublishedBundles(
        {
          page: pageParam as number,
          limit: BUNDLES_PAGE_SIZE,
          sortBy: "sort_order",
          sortOrder: "asc",
        },
        tenantHost
      );
      return result;
    },
    initialPageParam: 1,
  });

  return dehydrate(queryClient);
}
