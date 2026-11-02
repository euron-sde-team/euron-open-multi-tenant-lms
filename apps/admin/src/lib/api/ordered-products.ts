import { apiClient } from "./axios";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

const BASE = "/tenant/ordered-products";

/** The catalogs an admin can arrange by hand. */
export type OrderableEntity =
  | "courses"
  | "books"
  | "bundles"
  | "batches"
  | "test_series";

/**
 * Which course tab is being arranged. SHORTS is a course_type rather than a
 * mode, but the admin shows it as a fifth tab alongside the three modes and
 * each tab is its own list, so it travels on the same parameter.
 */
export type CourseOrderMode = "SELF_PACED";

export interface OrderedProductsSettings {
  enabled: boolean;
  enabled_at: string | null;
}

export interface OrderableItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  sort_order: number;
}

export interface ReorderResult {
  updated: number;
  items: Array<{ id: string; sort_order: number }>;
}

export const orderedProductsApi = {
  getSettings: async (): Promise<OrderedProductsSettings> => {
    const res =
      await apiClient.get<ApiResponse<OrderedProductsSettings>>(
        `${BASE}/settings`
      );
    return res.data.data;
  },

  updateSettings: async (
    enabled: boolean
  ): Promise<OrderedProductsSettings> => {
    const res = await apiClient.put<ApiResponse<OrderedProductsSettings>>(
      `${BASE}/settings`,
      { enabled }
    );
    return res.data.data;
  },

  list: async (
    entity: OrderableEntity,
    mode?: CourseOrderMode
  ): Promise<OrderableItem[]> => {
    const res = await apiClient.get<ApiResponse<{ items: OrderableItem[] }>>(
      `${BASE}/${entity}`,
      { params: mode ? { mode } : undefined }
    );
    return res.data.data.items;
  },

  /**
   * `itemIds` is the COMPLETE desired order for this list, not just the moved
   * row. The server rejects a partial set with 409 STALE_CATALOG rather than
   * applying an order that strands rows it wasn't told about.
   *
   * `mode` travels in the body: this is a PUT that already carries one, and
   * requiring a query param alongside it is easy to forget.
   */
  reorder: async (
    entity: OrderableEntity,
    itemIds: string[],
    mode?: CourseOrderMode
  ): Promise<ReorderResult> => {
    const res = await apiClient.put<ApiResponse<ReorderResult>>(
      `${BASE}/${entity}/reorder`,
      { item_ids: itemIds, ...(mode ? { mode } : {}) }
    );
    return res.data.data;
  },
};
