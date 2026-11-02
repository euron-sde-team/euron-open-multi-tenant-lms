import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { coursesLmsApi } from "../api/courses-lms";
import type { CourseInstructorResponse } from "../types/course-lms";

export const courseInstructorKeys = {
  all: ["course-instructors"] as const,
  list: (courseId: string) => [...courseInstructorKeys.all, courseId] as const,
};

export const useCourseInstructors = (courseId?: string) => {
  return useQuery<CourseInstructorResponse[]>({
    queryKey: courseInstructorKeys.list(courseId ?? ""),
    queryFn: () => coursesLmsApi.getCourseInstructors(courseId!),
    enabled: !!courseId,
  });
};

export const useSyncCourseInstructors = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      instructorIds,
    }: {
      courseId: string;
      instructorIds: string[];
    }) => coursesLmsApi.syncCourseInstructors(courseId, instructorIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: courseInstructorKeys.list(variables.courseId),
      });
    },
  });
};
