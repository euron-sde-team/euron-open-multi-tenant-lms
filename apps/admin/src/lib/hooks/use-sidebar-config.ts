import type { SidebarNavItem } from "@open-mtlms/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { sidebarApi, type SidebarConfigResponse } from "../api/sidebar";

export const sidebarKeys = {
  all: ["sidebar"] as const,
  config: (tenantId: string) => [...sidebarKeys.all, "config", tenantId] as const,
};

export const useSidebarConfig = (tenantId: string | undefined) => {
  return useQuery<SidebarConfigResponse>({
    queryKey: sidebarKeys.config(tenantId ?? ""),
    queryFn: () => sidebarApi.getConfig(),
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useUpdateNavItem = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  const key = sidebarKeys.config(tenantId ?? "");
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<SidebarNavItem, "label" | "icon" | "visible" | "badge" | "isExternal">> }) =>
      sidebarApi.updateItem(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SidebarConfigResponse>(key);
      if (previous) {
        queryClient.setQueryData<SidebarConfigResponse>(key, {
          ...previous,
          items: previous.items.map((item) =>
            item.id === id ? { ...item, ...data } : item
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
};

export const useAddCustomLink = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  const key = sidebarKeys.config(tenantId ?? "");
  return useMutation({
    mutationFn: (data: { label: string; href: string; icon?: string; isExternal?: boolean }) =>
      sidebarApi.addCustomLink(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
};

export const useDeleteCustomLink = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  const key = sidebarKeys.config(tenantId ?? "");
  return useMutation({
    mutationFn: (id: string) => sidebarApi.deleteCustomLink(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SidebarConfigResponse>(key);
      if (previous) {
        queryClient.setQueryData<SidebarConfigResponse>(key, {
          ...previous,
          items: previous.items.filter((item) => item.id !== id),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
};

export const useReorderNavItems = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  const key = sidebarKeys.config(tenantId ?? "");
  return useMutation({
    mutationFn: (orderedIds: string[]) => sidebarApi.reorderItems(orderedIds),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SidebarConfigResponse>(key);
      if (previous) {
        const itemMap = new Map(previous.items.map((item) => [item.id, item]));
        const reordered = orderedIds
          .map((id) => itemMap.get(id))
          .filter(Boolean) as SidebarConfigResponse["items"];
        queryClient.setQueryData<SidebarConfigResponse>(key, {
          ...previous,
          items: reordered,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
};
