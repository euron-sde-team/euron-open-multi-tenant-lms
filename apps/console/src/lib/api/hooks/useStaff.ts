import { useMutation, useQuery, useQueryClient } from 'react-query';

import {
  getStaffMemberDetails,
  listStaffMembers,
  StaffMemberProfileResponse,
  updateStaffMember,
} from '@/lib/api/staff';

import {
  ApiResponse,
  GlobalStaffMemberDetailsResponse,
  GlobalStaffMembersFilters,
  GlobalStaffMembersListResponse,
  UpdateTenantUserRequest,
} from '../types';

/**
 * Get all staff members (end-users) across all tenants (server-side pagination)
 */
export const useGetStaffMembers = (filters?: GlobalStaffMembersFilters) => {
  return useQuery<GlobalStaffMembersListResponse, Error>({
    queryKey: ['staff-members', filters],
    queryFn: async () => {
      const response = await listStaffMembers(filters);
      return response.data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
};

/**
 * Get detailed staff member info (memberships, roles)
 */
export const useGetStaffMemberDetails = (userId: string | null) => {
  return useQuery<GlobalStaffMemberDetailsResponse, Error>({
    queryKey: ['staff-members', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      const response = await getStaffMemberDetails(userId);
      return response.data;
    },
    enabled: !!userId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Update a staff member's global profile (email/phone)
 */
export const useUpdateStaffMember = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<StaffMemberProfileResponse>,
    Error,
    { userId: string; data: UpdateTenantUserRequest }
  >({
    mutationFn: async ({ userId, data }) => {
      return updateStaffMember(userId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['staff-members']);
    },
  });
};
