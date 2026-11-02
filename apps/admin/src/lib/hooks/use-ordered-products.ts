import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  orderedProductsApi,
  type CourseOrderMode,
  type OrderableEntity,
} from "../api/ordered-products";
import { useTenantStore } from "../stores/tenant-store";

export const orderedProductsKeys = {
  all: ["ordered-products"] as const,
  settings: (tenantId: string) =>
    [...orderedProductsKeys.all, "settings", tenantId] as const,
  list: (tenantId: string, entity: OrderableEntity, mode?: string) =>
    [...orderedProductsKeys.all, "list", tenantId, entity, mode ?? ""] as const,
};

/**
 * The tenant-wide switch. Drag handles only appear when this is on, so the
 * list pages read it too, not just the settings screen.
 */
export const useOrderedProductsSettings = () => {
  const selectedTenantId = useTenantStore((s) => s.selectedTenantId);
  return useQuery({
    queryKey: orderedProductsKeys.settings(selectedTenantId ?? ""),
    queryFn: () => orderedProductsApi.getSettings(),
    enabled: !!selectedTenantId,
  });
};

export const useUpdateOrderedProductsSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => orderedProductsApi.updateSettings(enabled),
    onSuccess: () => {
      // Every list page reads this switch to decide whether to show handles.
      queryClient.invalidateQueries({ queryKey: orderedProductsKeys.all });
    },
  });
};

/**
 * Persist a new arrangement.
 *
 * Deliberately NOT optimistic. The pages that own these lists keep them in
 * local state and move the card the moment you drop it, so the UI is already
 * ahead of the server; a second optimistic layer here would just be a cache to
 * keep in sync. On failure the page restores its own pre-drag snapshot.
 */
export const useReorderProducts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entity,
      itemIds,
      mode,
    }: {
      entity: OrderableEntity;
      itemIds: string[];
      mode?: CourseOrderMode;
    }) => orderedProductsApi.reorder(entity, itemIds, mode),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: orderedProductsKeys.all });
    },
  });
};
