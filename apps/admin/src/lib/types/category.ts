export interface Category {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoriesListResponse {
  categories: Category[];
  total: number;
  page: number;
  limit: number;
}
