import type { SidebarNavItem } from "@open-mtlms/shared";

import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export interface SidebarConfigResponse {
  items: (SidebarNavItem & { featureAvailable?: boolean })[];
  enabledFeatures: string[];
  persisted: boolean;
}

export const sidebarApi = {
  getConfig: async (): Promise<SidebarConfigResponse> => {
    const res = await apiClient.get<ApiResponse<SidebarConfigResponse>>(
      "/tenant/sidebar"
    );
    return res.data.data;
  },

  updateItem: async (
    id: string,
    data: Partial<Pick<SidebarNavItem, "label" | "icon" | "visible" | "badge" | "isExternal">>
  ): Promise<SidebarNavItem> => {
    const res = await apiClient.patch<ApiResponse<SidebarNavItem>>(
      `/tenant/sidebar/items/${id}`,
      data
    );
    return res.data.data;
  },

  addCustomLink: async (data: {
    label: string;
    href: string;
    icon?: string;
    isExternal?: boolean;
  }): Promise<SidebarNavItem> => {
    const res = await apiClient.post<ApiResponse<SidebarNavItem>>(
      "/tenant/sidebar/items",
      data
    );
    return res.data.data;
  },

  deleteCustomLink: async (id: string): Promise<void> => {
    await apiClient.delete(`/tenant/sidebar/items/${id}`);
  },

  reorderItems: async (orderedIds: string[]): Promise<void> => {
    await apiClient.put("/tenant/sidebar/reorder", { orderedIds });
  },
};
