import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  memberFormApi,
  type MemberFormConfig,
  type MemberFormSummary,
  type SaveMemberFormRequest,
} from "../api/member-form";

export const memberFormKeys = {
  all: ["member-form"] as const,
  list: (tenantId: string) => [...memberFormKeys.all, "list", tenantId] as const,
  form: (tenantId: string, formId: string) =>
    [...memberFormKeys.all, "form", tenantId, formId] as const,
  responses: (tenantId: string, formId: string, page: number) =>
    [...memberFormKeys.all, "responses", tenantId, formId, page] as const,
  memberResponses: (tenantId: string, memberId: string) =>
    [...memberFormKeys.all, "member-responses", tenantId, memberId] as const,
};

export const useMemberForms = (tenantId: string | undefined) =>
  useQuery<MemberFormSummary[]>({
    queryKey: memberFormKeys.list(tenantId ?? ""),
    queryFn: () => memberFormApi.listForms(),
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });

export const useMemberForm = (
  tenantId: string | undefined,
  formId: string | undefined
) =>
  useQuery<MemberFormConfig>({
    queryKey: memberFormKeys.form(tenantId ?? "", formId ?? ""),
    queryFn: () => memberFormApi.getForm(formId!),
    enabled: !!tenantId && !!formId,
  });

export const useCreateMemberForm = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SaveMemberFormRequest>) =>
      memberFormApi.createForm(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: memberFormKeys.list(tenantId ?? ""),
      });
    },
  });
};

export const useUpdateMemberForm = (
  tenantId: string | undefined,
  formId: string | undefined
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveMemberFormRequest) =>
      memberFormApi.updateForm(formId!, data),
    onSuccess: (config) => {
      queryClient.setQueryData(
        memberFormKeys.form(tenantId ?? "", formId ?? ""),
        config
      );
      queryClient.invalidateQueries({
        queryKey: memberFormKeys.list(tenantId ?? ""),
      });
    },
  });
};

export const useDeleteMemberForm = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) => memberFormApi.deleteForm(formId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: memberFormKeys.list(tenantId ?? ""),
      });
    },
  });
};

export const useSetMemberFormActive = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ formId, active }: { formId: string; active: boolean }) =>
      memberFormApi.setActive(formId, active),
    // Optimistically flip the toggle on the list for a snappy feel; roll back
    // if the server rejects (e.g. activating a form with no fields).
    onMutate: async ({ formId, active }) => {
      const key = memberFormKeys.list(tenantId ?? "");
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MemberFormSummary[]>(key);
      queryClient.setQueryData<MemberFormSummary[]>(key, (old) =>
        old?.map((f) => (f.id === formId ? { ...f, active } : f))
      );
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: memberFormKeys.list(tenantId ?? ""),
      });
    },
  });
};

export const useReorderMemberForms = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      memberFormApi.reorderForms(orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: memberFormKeys.list(tenantId ?? ""),
      });
    },
  });
};

export const useMemberFormResponses = (
  tenantId: string | undefined,
  formId: string | undefined,
  page: number
) =>
  useQuery({
    queryKey: memberFormKeys.responses(tenantId ?? "", formId ?? "", page),
    queryFn: () => memberFormApi.listResponses(formId!, { page, limit: 25 }),
    enabled: !!tenantId && !!formId,
    placeholderData: (prev) => prev,
  });

export const useMemberResponses = (
  tenantId: string | undefined,
  memberId: string | undefined
) =>
  useQuery({
    queryKey: memberFormKeys.memberResponses(tenantId ?? "", memberId ?? ""),
    queryFn: () => memberFormApi.listMemberResponses(memberId!),
    enabled: !!tenantId && !!memberId,
  });
