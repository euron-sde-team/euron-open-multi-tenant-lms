import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { certificateTemplatesApi } from "../api/certificate-templates";

export const certificateTemplateKeys = {
  all: ["certificate-templates"] as const,
  list: () => [...certificateTemplateKeys.all, "list"] as const,
  selected: () => [...certificateTemplateKeys.all, "selected"] as const,
};

export const useCertificateTemplates = () => {
  return useQuery({
    queryKey: certificateTemplateKeys.list(),
    queryFn: () => certificateTemplatesApi.getTemplates(),
  });
};

export const useSelectedCertificateTemplate = (enabled = true) => {
  return useQuery({
    queryKey: certificateTemplateKeys.selected(),
    queryFn: () => certificateTemplatesApi.getSelected(),
    enabled,
  });
};

export const useSelectCertificateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, logoUrl }: { templateId: string; logoUrl?: string | null }) =>
      certificateTemplatesApi.selectTemplate(templateId, logoUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: certificateTemplateKeys.selected(),
      });
    },
  });
};

export const useToggleCertificatePublish = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (isPublished: boolean) =>
      certificateTemplatesApi.togglePublish(isPublished),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: certificateTemplateKeys.selected(),
      });
    },
    retry: false,
  });
};
