import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export interface EnrolledCoursesSettings {
  /**
   * When true, learners on this tenant only see the courses they are enrolled
   * in, the public catalog / explore surfaces are hidden across web and mobile,
   * and enrolled-only listing is forced for everyone (including subscribers).
   * Default: false.
   */
  enrolled_courses_only_enabled: boolean;
  enrolled_courses_only_enabled_at: string | null;
}

export type UpdateEnrolledCoursesSettingsInput = {
  enrolled_courses_only_enabled: boolean;
};

const BASE = "/tenant/enrolled-courses-settings";

export const enrolledCoursesSettingsApi = {
  get: async (): Promise<EnrolledCoursesSettings> => {
    const res = await apiClient.get<ApiResponse<EnrolledCoursesSettings>>(BASE);
    return res.data.data;
  },

  update: async (
    data: UpdateEnrolledCoursesSettingsInput,
  ): Promise<EnrolledCoursesSettings> => {
    const res = await apiClient.put<ApiResponse<EnrolledCoursesSettings>>(BASE, data);
    return res.data.data;
  },
};
