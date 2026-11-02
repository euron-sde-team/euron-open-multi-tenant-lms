"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { onboardingApi } from "../api/onboarding";

const onboardingKeys = {
  all: ["onboarding"] as const,
  checklist: () => [...onboardingKeys.all, "checklist"] as const,
};

export const useOnboardingChecklist = (enabled = true) => {
  return useQuery({
    queryKey: onboardingKeys.checklist(),
    queryFn: onboardingApi.getChecklist,
    enabled,
    // Refetch when window regains focus so the checklist updates as the user
    // makes progress (uploads a video, publishes a course), feels alive.
    refetchOnWindowFocus: true,
  });
};

export const useDismissChecklist = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: onboardingApi.dismissChecklist,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: onboardingKeys.checklist() });
    },
  });
};
