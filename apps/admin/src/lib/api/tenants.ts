import type { LayoutFooter, TenantLayout } from "@open-mtlms/shared";

import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export const tenantsApi = {
  /**
   * Get tenant layout (header, sidebar, footer, topBar config).
   * Returns null if no layout has been saved yet.
   */
  getLayout: async (tenantId: string): Promise<TenantLayout | null> => {
    const response = await apiClient.get<ApiResponse<TenantLayout | null>>(
      `/tenants/${tenantId}/layout`
    );
    return response.data.data;
  },

  /**
   * Save/update tenant layout.
   */
  updateLayout: async (tenantId: string, layout: TenantLayout): Promise<TenantLayout> => {
    const response = await apiClient.put<ApiResponse<TenantLayout>>(
      `/tenants/${tenantId}/layout`,
      layout
    );
    return response.data.data;
  },

  /**
   * Generate footer config from tenant data (sidebar, pages, categories, org details).
   */
  generateFooter: async (tenantId: string): Promise<LayoutFooter> => {
    const response = await apiClient.post<ApiResponse<LayoutFooter>>(
      `/tenants/${tenantId}/layout/generate-footer`
    );
    return response.data.data;
  },
};
