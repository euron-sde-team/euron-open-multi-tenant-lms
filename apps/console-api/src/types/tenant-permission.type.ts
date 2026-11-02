/**
 * Tenant Permission Management Types
 * Request/Response DTOs for tenant permissions and role-permission mappings
 */

// ============================================
// TENANT PERMISSION TYPES
// ============================================

export interface TenantPermissionResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at: Date;
}

export interface CreateTenantPermissionRequest {
  code: string;
  name: string;
  category: string;
  description?: string;
}

export interface UpdateTenantPermissionRequest {
  name?: string;
  description?: string;
  category?: string;
}

export interface TenantPermissionQueryParams {
  category?: string;
  search?: string;
}

// ============================================
// ROLE-PERMISSION MAPPING TYPES
// ============================================

export interface SetRolePermissionsRequest {
  permission_ids: string[];
}

export interface AddRolePermissionRequest {
  permission_id: string;
}

export interface TenantRoleWithPermissionsResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permission_count: number;
  permissions: TenantPermissionResponse[];
}
