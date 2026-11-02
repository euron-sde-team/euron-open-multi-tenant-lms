import apiClient from './client';
import {
  ApiResponse,
  GlobalStaffMemberDetailsResponse,
  GlobalStaffMembersFilters,
  GlobalStaffMembersListResponse,
  UpdateTenantUserRequest,
} from './types';

export interface StaffMemberProfileResponse {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: string;
  email_verified: boolean;
  phone: string | null;
  phone_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * List all staff members (tenant users) across all tenants
 * GET /admin/staff-members
 */
export const listStaffMembers = async (
  params?: GlobalStaffMembersFilters,
): Promise<ApiResponse<GlobalStaffMembersListResponse>> => {
  const response = await apiClient.get<
    ApiResponse<GlobalStaffMembersListResponse>
  >('/admin/staff-members', { params });
  return response.data;
};

/**
 * Get detailed staff member info (memberships, roles)
 * GET /admin/staff-members/:userId
 */
export const getStaffMemberDetails = async (
  userId: string,
): Promise<ApiResponse<GlobalStaffMemberDetailsResponse>> => {
  const response = await apiClient.get<
    ApiResponse<GlobalStaffMemberDetailsResponse>
  >(`/admin/staff-members/${userId}`);
  return response.data;
};

/**
 * Update a staff member's global profile (email/phone).
 * PATCH /admin/staff-members/:userId
 */
export const updateStaffMember = async (
  userId: string,
  data: UpdateTenantUserRequest,
): Promise<ApiResponse<StaffMemberProfileResponse>> => {
  const response = await apiClient.patch<
    ApiResponse<StaffMemberProfileResponse>
  >(`/admin/staff-members/${userId}`, data);
  return response.data;
};

/**
 * Export all staff members as Excel file
 * GET /admin/staff-members/export
 */
export const exportStaffMembers = async (
  startDate?: string,
  endDate?: string,
): Promise<Blob> => {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const response = await apiClient.get('/admin/staff-members/export', {
    params,
    responseType: 'blob',
  });
  return response.data as Blob;
};
