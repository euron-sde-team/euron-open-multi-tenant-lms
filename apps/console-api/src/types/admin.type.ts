/**
 * Admin Management Types
 * Request/Response DTOs for admin user, role, and permission APIs
 */

// ============================================
// ADMIN USER TYPES
// ============================================

export interface CreateAdminUserRequest {
  email: string;
  password: string;
  name: string;
  avatar_url?: string;
  roleIds?: string[]; // Optional roles to assign on creation
}

export interface UpdateAdminUserRequest {
  name?: string;
  avatar_url?: string;
  email_verified?: boolean;
}

export interface AdminUserResponse {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: string;
  email_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  roles: AdminRoleSummary[];
}

export interface AdminUserListResponse {
  users: AdminUserResponse[];
  total: number;
}

export interface AssignRoleRequest {
  roleId: string;
}

// ============================================
// ADMIN ROLE TYPES
// ============================================

export interface CreateAdminRoleRequest {
  code: string;
  name: string;
  description?: string;
  permissionIds?: string[]; // Optional permissions to assign on creation
}

export interface UpdateAdminRoleRequest {
  name?: string;
  description?: string;
}

export interface AdminRoleSummary {
  id: string;
  code: string;
  name: string;
}

export interface AdminRoleResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
  permissions: AdminPermissionSummary[];
  user_count: number;
}

export interface AdminRoleListResponse {
  roles: AdminRoleResponse[];
  total: number;
}

export interface AssignPermissionRequest {
  permissionId: string;
}

// ============================================
// ADMIN PERMISSION TYPES
// ============================================

export interface CreateAdminPermissionRequest {
  code: string;
  name: string;
  description?: string;
  category?: string;
}

export interface UpdateAdminPermissionRequest {
  name?: string;
  description?: string;
  category?: string;
}

export interface AdminPermissionSummary {
  id: string;
  code: string;
  name: string;
}

export interface AdminPermissionResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at: Date;
  role_count: number;
}

export interface AdminPermissionListResponse {
  permissions: AdminPermissionResponse[];
  total: number;
  by_category: Record<string, AdminPermissionResponse[]>;
}

// ============================================
// QUERY PARAMETERS
// ============================================

export interface AdminUserQueryParams {
  status?: string;
  search?: string; // Search by email or name
  page?: number;
  limit?: number;
}

export interface AdminRoleQueryParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface AdminPermissionQueryParams {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}
