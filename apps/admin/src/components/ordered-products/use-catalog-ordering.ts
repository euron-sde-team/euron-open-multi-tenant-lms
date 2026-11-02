"use client";

import { useToast } from "@open-mtlms/core";
import { useCallback } from "react";

import { ApiError } from "@/lib/api/axios";
import type {
  CourseOrderMode,
  OrderableEntity,
} from "@/lib/api/ordered-products";
import {
  useOrderedProductsSettings,
  useReorderProducts,
} from "@/lib/hooks/use-ordered-products";

interface UseCatalogOrderingArgs {
  entity: OrderableEntity;
  /** Required for courses, each mode is arranged separately. */
  mode?: CourseOrderMode;
  /**
   * True when a search or filter is narrowing the list. Dragging a subset
   * can't express a whole-list order, so handles come off.
   */
  isFiltered: boolean;
  /** Refresh the page's own list once the server has the new order. */
  onSaved?: () => void;
}

/**
 * Everything a catalog page needs to become drag-orderable: whether to show
 * handles, why they're hidden, and a save function the grid can await.
 */
export function useCatalogOrdering({
  entity,
  mode,
  isFiltered,
  onSaved,
}: UseCatalogOrderingArgs) {
  const { toast } = useToast();
  const { data: settings } = useOrderedProductsSettings();
  const reorder = useReorderProducts();

  const featureOn = settings?.enabled === true;
  const canDrag = featureOn && !isFiltered;

  const save = useCallback(
    async (orderedIds: string[]) => {
      try {
        await reorder.mutateAsync({ entity, itemIds: orderedIds, mode });
        onSaved?.();
      } catch (error) {
        // 409 means someone else added, deleted or published something while
        // this list was open, so the order we sent no longer describes it.
        // Say that plainly, the fix is a refresh, not a retry.
        if (error instanceof ApiError && error.status === 409) {
          toast({
            title: "This list changed",
            description:
              "Someone else updated it while you were arranging. Refresh to see the latest, then drag again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Couldn't save the new order",
            description:
              error instanceof Error
                ? error.message
                : "Please try again in a moment.",
            variant: "destructive",
          });
        }
        // Tell the grid to put the cards back where they were.
        throw error;
      }
    },
    [entity, mode, onSaved, reorder, toast]
  );

  return {
    /** Show drag handles? */
    canDrag,
    /** Is the tenant-wide switch on at all? */
    featureOn,
    /** Feature is on but this view is filtered, worth explaining. */
    blockedByFilter: featureOn && isFiltered,
    save,
    isSaving: reorder.isPending,
  };
}
