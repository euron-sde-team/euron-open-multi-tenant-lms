import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { memberFormApi } from "@/lib/api/member-form";

export const memberFormKeys = {
  // User-scoped: the response carries a per-member `completed` flag, so the
  // cache must not be shared across users on the same browser/tab.
  config: (memberId: string) => ["member-form", memberId] as const,
};

export function useMemberForms(enabled: boolean, memberId: string | undefined) {
  return useQuery({
    queryKey: memberFormKeys.config(memberId ?? ""),
    queryFn: () => memberFormApi.get(),
    enabled: enabled && !!memberId,
    staleTime: 60_000,
  });
}

export function useSubmitMemberForm(memberId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      formId,
      data,
    }: {
      formId: string;
      data: Record<string, unknown>;
    }) => memberFormApi.submit(formId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memberFormKeys.config(memberId ?? "") });
    },
  });
}
