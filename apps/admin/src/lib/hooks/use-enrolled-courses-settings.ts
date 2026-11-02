import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  enrolledCoursesSettingsApi,
  type UpdateEnrolledCoursesSettingsInput,
} from "../api/enrolled-courses-settings";
import { useTenantStore } from "../stores/tenant-store";

export const enrolledCoursesSettingsKeys = {
  all: ["enrolled-courses-settings"] as const,
};

export const useEnrolledCoursesSettings = () => {
  const selectedTenantId = useTenantStore((s) => s.selectedTenantId);
  return useQuery({
    queryKey: [...enrolledCoursesSettingsKeys.all, selectedTenantId],
    queryFn: () => enrolledCoursesSettingsApi.get(),
    enabled: !!selectedTenantId,
  });
};

export const useUpdateEnrolledCoursesSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateEnrolledCoursesSettingsInput) =>
      enrolledCoursesSettingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enrolledCoursesSettingsKeys.all });
    },
  });
};
