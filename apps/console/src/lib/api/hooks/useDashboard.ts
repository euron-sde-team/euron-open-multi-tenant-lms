import { useQuery } from 'react-query';

import apiClient from '../client';
import { ApiResponse, DashboardStats } from '../types';

/**
 * Get aggregated dashboard statistics
 */
export const useGetDashboardStats = () => {
  return useQuery<DashboardStats, Error>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<DashboardStats>>(
        '/admin/dashboard/stats',
      );
      return response.data.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
};
