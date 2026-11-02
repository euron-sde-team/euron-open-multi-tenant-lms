import { useQuery } from 'react-query';

import apiClient from '../client';
import {
  ActivityFeedFilters,
  ActivityFeedListResponse,
  ApiResponse,
} from '../types';

/**
 * Get global activity feed (application + addon + usage events)
 */
export const useGetActivityFeed = (filters?: ActivityFeedFilters) => {
  return useQuery<ActivityFeedListResponse, Error>({
    queryKey: ['activity-feed', filters],
    queryFn: async () => {
      const response = await apiClient.get<
        ApiResponse<ActivityFeedListResponse>
      >('/admin/activity-feed', { params: filters });
      return response.data.data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
};
