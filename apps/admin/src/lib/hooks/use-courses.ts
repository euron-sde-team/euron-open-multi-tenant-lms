import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { captureEvent } from "../analytics";
import { coursesApi, type CreateCourseRequest } from "../api/courses";

import { availableRoutesKeys } from "./use-available-routes";
import { entitlementKeys } from "./use-entitlements";
import { COURSES_LMS_QUERY_KEY } from "./use-infinite-courses-lms";
import { pageKeys } from "./use-pages";

// ============================================================================
// REACT QUERY HOOKS FOR COURSES (backed by LMS courses table)
// ============================================================================

export const courseKeys = {
  all: ["courses"] as const,
  lists: () => [...courseKeys.all, "list"] as const,
  list: (tenantId: string, filters?: { mode?: string; courseType?: string }) =>
    [...courseKeys.lists(), tenantId, filters] as const,
  details: () => [...courseKeys.all, "detail"] as const,
  detail: (courseId: string) => [...courseKeys.details(), courseId] as const,
};

/**
 * List all courses for a tenant (from LMS courses table).
 * Optionally filter by mode and/or courseType at the API level.
 */
export const useCourses = (
  tenantId: string | undefined,
  page = 1,
  limit = 100,
  filters?: { mode?: string; courseType?: string }
) => {
  return useQuery({
    queryKey: courseKeys.list(tenantId || "", filters),
    queryFn: () => coursesApi.getCourses(tenantId!, page, limit, filters),
    enabled: !!tenantId,
  });
};

/**
 * Create a new course:
 *  1. Creates the LMS course record (backend does entitlement check + consume).
 *  2. Creates the landing page in tenant_pages.
 *  3. Redirects to the page editor.
 */
export const useCreateCourse = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: CreateCourseRequest) => coursesApi.createCourse(data),
    onSuccess: (result, variables) => {
      captureEvent("course_created", {
        course_id: result.lmsCourseId,
        tenant_id: variables.tenantId,
        mode: variables.mode,
      });
      queryClient.invalidateQueries({ queryKey: courseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: COURSES_LMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
      if (!variables.skipRedirect) {
        router.push(`/dashboard/courses/${result.pageId}/editor`);
      }
    },
    onError: (error) => {
      console.error("Create course error:", error);
    },
  });
};

/**
 * Delete a course (LMS record + linked page cleaned up by backend).
 */
export const useDeleteCourse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (courseId: string) => coursesApi.deleteCourse(courseId),
    onSuccess: (_, courseId) => {
      queryClient.removeQueries({ queryKey: courseKeys.detail(courseId) });
      queryClient.invalidateQueries({ queryKey: courseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: COURSES_LMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
    },
    onError: (error) => {
      console.error("Delete course error:", error);
    },
  });
};

/**
 * Toggle course publish status (DRAFT ↔ PUBLISHED in LMS courses table + landing page).
 */
export const useToggleCoursePublish = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      courseId,
      isPublished,
      pageId,
    }: {
      courseId: string;
      isPublished: boolean;
      pageId?: string | null;
    }) => coursesApi.togglePublish(courseId, isPublished, pageId),
    onSuccess: (_, variables) => {
      if (variables.isPublished) {
        captureEvent("course_published", {
          course_id: variables.courseId,
        });
      }
      queryClient.invalidateQueries({ queryKey: courseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: COURSES_LMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
    },
    onError: (error) => {
      console.error("Toggle course publish error:", error);
    },
    retry: false,
  });
};
