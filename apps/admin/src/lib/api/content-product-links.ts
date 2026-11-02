import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export interface LinkedProductItem {
  id: string;
  product_code: string;
  product_title: string | null;
  constraint_type: string;
  unit: string | null;
  usage_scope: string;
  usage_window: string;
  feature_key: string;
  feature_name: string | null;
  is_active: boolean;
  is_entitled: boolean;
  entitlement?: { limit_value: number; is_unlimited: boolean };
}

export interface LinkedProductsResponse {
  linked_products: LinkedProductItem[];
}

export interface LinkableProduct {
  product_code: string;
  product_title: string | null;
  constraint_type: string;
  unit: string | null;
  usage_scope: string;
  usage_window: string;
  feature_key: string;
  feature_name: string | null;
  limit_value: number;
  is_unlimited: boolean;
}

type ContentType = "courses" | "books" | "bundles";

function contentPath(contentType: ContentType, contentId: string): string {
  return `/tenant/${contentType}/${contentId}/linked-products`;
}

export async function getLinkedProducts(
  contentType: ContentType,
  contentId: string
): Promise<LinkedProductItem[]> {
  const response = await apiClient.get<ApiResponse<LinkedProductsResponse>>(
    contentPath(contentType, contentId)
  );
  return response.data.data.linked_products;
}

export async function setLinkedProducts(
  contentType: ContentType,
  contentId: string,
  productCodes: string[]
): Promise<LinkedProductItem[]> {
  const response = await apiClient.put<ApiResponse<LinkedProductsResponse>>(
    contentPath(contentType, contentId),
    { product_codes: productCodes }
  );
  return response.data.data.linked_products;
}

export async function getLinkableProducts(): Promise<LinkableProduct[]> {
  const response = await apiClient.get<ApiResponse<LinkableProduct[]>>(
    "/tenant/entitlements/linkable-products"
  );
  return response.data.data;
}

export const contentProductLinksApi = {
  getLinkedProducts,
  setLinkedProducts,
  getLinkableProducts,
};
