import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { courseSequenceApi } from "../api/course-sequence";

export const sequenceKeys = {
  all: ["course-sequence"] as const,
  settings: () => [...sequenceKeys.all, "settings"] as const,
  chain: () => [...sequenceKeys.all, "chain"] as const,
};

/** The tenant-wide master switch. */
export function useSequenceSettings() {
  return useQuery({
    queryKey: sequenceKeys.settings(),
    queryFn: () => courseSequenceApi.getSettings(),
  });
}

export function useUpdateSequenceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => courseSequenceApi.updateSettings(enabled),
    // Any chain in the tenant may now be enforced (or stop being), so every
    // sequence view is stale.
    onSuccess: () => qc.invalidateQueries({ queryKey: sequenceKeys.all }),
  });
}

/** The whole tenant chain, for the sequence builder. */
export function useCourseChain() {
  return useQuery({
    queryKey: sequenceKeys.chain(),
    queryFn: () => courseSequenceApi.getChain(),
  });
}

export function useSaveChain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseIds: string[]) => courseSequenceApi.saveChain(courseIds),
    // The whole chain changed, every sequence view is stale.
    onSuccess: () => qc.invalidateQueries({ queryKey: sequenceKeys.all }),
  });
}
