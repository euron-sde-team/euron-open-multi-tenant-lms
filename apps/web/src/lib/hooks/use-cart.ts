"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cartApi, type CartItemType, type CartResponse } from "@/lib/api/cart";
import { useUserAuthStore } from "@/lib/stores/auth-store";

const CART_QUERY_KEY = ["cart"] as const;

export function useCart() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useUserAuthStore();

  const {
    data,
    isLoading,
    isError,
    refetch: refetchCart,
  } = useQuery<CartResponse>({
    queryKey: CART_QUERY_KEY,
    queryFn: () => cartApi.getCart(),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const summary = useMemo(
    () =>
      data?.summary ?? {
        total_items: 0,
        purchasable_items: 0,
        total_inr: "0",
        total_usd: "0",
      },
    [data?.summary]
  );

  const addMutation = useMutation({
    mutationFn: (body: { item_type: CartItemType; item_id: string; coupon_code?: string }) =>
      cartApi.addItem(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (body: { item_type: CartItemType; item_id: string }) =>
      cartApi.removeItem(body),
    onMutate: async (body) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });
      const previous = queryClient.getQueryData<CartResponse>(CART_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<CartResponse>(CART_QUERY_KEY, {
          ...previous,
          items: previous.items.filter(
            (i) => !(i.item_type === body.item_type && i.item_id === body.item_id)
          ),
          summary: {
            ...previous.summary,
            total_items: Math.max(0, previous.summary.total_items - 1),
          },
        });
      }
      return { previous };
    },
    onError: (_err, _body, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(CART_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => cartApi.clearCart(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });

  const addToCart = useCallback(
    (
      body: { item_type: CartItemType; item_id: string; coupon_code?: string },
      options?: { onSuccess?: () => void; onError?: (err: Error) => void }
    ) => {
      addMutation.mutate(body, {
        onSuccess: () => {
          options?.onSuccess?.();
        },
        onError: (err) => {
          options?.onError?.(err as Error);
        },
      });
    },
    [addMutation]
  );

  const removeItemCouponMutation = useMutation({
    mutationFn: (itemId: string) => cartApi.removeItemCoupon(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });

  const removeItemCoupon = useCallback(
    (itemId: string) => {
      removeItemCouponMutation.mutate(itemId);
    },
    [removeItemCouponMutation]
  );

  const removeFromCart = useCallback(
    (body: { item_type: CartItemType; item_id: string }) => {
      removeMutation.mutate(body);
    },
    [removeMutation]
  );

  const clearCart = useCallback(() => {
    clearMutation.mutate();
  }, [clearMutation]);

  const isInCart = useCallback(
    (itemId: string) => items.some((i) => i.item_id === itemId),
    [items]
  );

  const cartCount = summary.total_items;

  const invalidateCart = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
  }, [queryClient]);

  return useMemo(
    () => ({
      items,
      summary,
      isLoading,
      isError,
      addToCart,
      isAdding: addMutation.isPending,
      addError: addMutation.error,
      removeFromCart,
      isRemoving: removeMutation.isPending,
      clearCart,
      isInCart,
      cartCount,
      refetchCart,
      invalidateCart,
      removeItemCoupon,
    }),
    [
      items,
      summary,
      isLoading,
      isError,
      addToCart,
      addMutation.isPending,
      addMutation.error,
      removeFromCart,
      removeMutation.isPending,
      clearCart,
      isInCart,
      cartCount,
      refetchCart,
      invalidateCart,
      removeItemCoupon,
    ]
  );
}
