import type { ApiResponse } from "../types/auth";
import type {
  TenantApplication,
  ResolvedApplication,
} from "../types/features";

import { apiClient } from "./axios";

/**
 * Get active applications for the current tenant
 */
export async function getApplications(): Promise<TenantApplication[]> {
  const response = await apiClient.get<ApiResponse<TenantApplication[]>>(
    "/tenant/applications"
  );
  return response.data.data;
}

/**
 * Get resolved features for the current tenant.
 * Optionally filter by application code (e.g. "lms").
 */
export async function getResolvedFeatures(
  applicationCode?: string
): Promise<ResolvedApplication[]> {
  const params = applicationCode
    ? `?application_code=${encodeURIComponent(applicationCode)}`
    : "";
  const response = await apiClient.get<ApiResponse<ResolvedApplication[]>>(
    `/tenant/features${params}`
  );
  return response.data.data;
}

/**
 * Toggle publish on a course (handles entitlement consume/release on the backend).
 * POST /tenant/courses/:courseId/toggle-publish
 */
export async function togglePublishCourse(
  courseId: string,
  publish: boolean
): Promise<void> {
  await apiClient.post(`/tenant/courses/${courseId}/toggle-publish`, {
    publish,
  });
}

export const applicationsApi = {
  getApplications,
  getResolvedFeatures,
  togglePublishCourse,
};
