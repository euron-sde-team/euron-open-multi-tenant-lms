/**
 * Content-Product Linking Types
 * Types for linking platform products to tenant content (courses, books, bundles)
 */

export type LinkableContentType = "COURSE" | "BOOK" | "BUNDLE";

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

export interface SetLinkedProductsRequest {
  product_codes: string[];
}

export interface LinkedProductsResponse {
  linked_products: LinkedProductItem[];
}
