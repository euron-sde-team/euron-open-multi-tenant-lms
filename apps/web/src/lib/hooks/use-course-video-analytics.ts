import { useQuery } from "@tanstack/react-query";
import { getCourseVideoAnalytics } from "@/lib/api/course-video-analytics";

export function useCourseVideoAnalytics(courseId: string | null | undefined) {
  return useQuery({
    queryKey: ["course-video-analytics", courseId],
    queryFn: () => getCourseVideoAnalytics(courseId as string),
    enabled: !!courseId,
    staleTime: 5 * 60_000,
  });
}
