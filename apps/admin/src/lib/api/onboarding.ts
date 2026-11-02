import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  hint_url?: string;
  action_url: string;
}

export interface ChecklistResponse {
  items: ChecklistItem[];
  percent_done: number;
  is_completed: boolean;
  can_share_academy_link: boolean;
  academy_preview_url: string | null;
  sample_course_slug: string | null;
  is_dismissed: boolean;
}

export const onboardingApi = {
  getChecklist: async (): Promise<ChecklistResponse> => {
    const response = await apiClient.get<ApiResponse<ChecklistResponse>>(
      "/tenant/onboarding/checklist",
    );
    return response.data.data;
  },
  dismissChecklist: async (): Promise<{ dismissed_at: string }> => {
    const response = await apiClient.post<ApiResponse<{ dismissed_at: string }>>(
      "/tenant/onboarding/dismiss",
    );
    return response.data.data;
  },
};
