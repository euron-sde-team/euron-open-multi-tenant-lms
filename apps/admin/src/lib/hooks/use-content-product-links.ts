import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  contentProductLinksApi,
  type LinkedProductItem,
  type LinkableProduct,
} from "@/lib/api/content-product-links";

type ContentType = "courses" | "books" | "bundles";

export const contentProductLinkKeys = {
  all: ["content-product-links"] as const,
  linked: (contentType: ContentType, contentId: string) =>
    [...contentProductLinkKeys.all, "linked", contentType, contentId] as const,
  linkable: () => [...contentProductLinkKeys.all, "linkable"] as const,
};

export function useLinkedProducts(
  contentType: ContentType,
  contentId: string | undefined
) {
  return useQuery<LinkedProductItem[]>({
    queryKey: contentProductLinkKeys.linked(
      contentType,
      contentId ?? ""
    ),
    queryFn: () =>
      contentProductLinksApi.getLinkedProducts(contentType, contentId!),
    enabled: !!contentId,
  });
}

export function useLinkableProducts(enabled = true) {
  return useQuery<LinkableProduct[]>({
    queryKey: contentProductLinkKeys.linkable(),
    queryFn: () => contentProductLinksApi.getLinkableProducts(),
    enabled,
  });
}

export function useSetLinkedProducts(
  contentType: ContentType,
  contentId: string | undefined
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productCodes: string[]) =>
      contentProductLinksApi.setLinkedProducts(
        contentType,
        contentId!,
        productCodes
      ),
    onSuccess: () => {
      if (contentId) {
        queryClient.invalidateQueries({
          queryKey: contentProductLinkKeys.linked(contentType, contentId),
        });
      }
    },
  });
}
