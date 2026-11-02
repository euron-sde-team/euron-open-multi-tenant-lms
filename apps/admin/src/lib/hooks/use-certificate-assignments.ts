import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  certificateAssignmentsApi,
  type CertOfferingType,
  type SetCertificateAssignmentInput,
} from "../api/certificate-assignments";
import { useTenantStore } from "../stores/tenant-store";

export const certificateAssignmentsKeys = {
  all: ["certificate-assignments"] as const,
};

export const useCertificateAssignments = () => {
  const selectedTenantId = useTenantStore((s) => s.selectedTenantId);
  return useQuery({
    queryKey: [...certificateAssignmentsKeys.all, selectedTenantId],
    queryFn: () => certificateAssignmentsApi.list(),
    enabled: !!selectedTenantId,
  });
};

export const useSetCertificateAssignment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { offeringType: CertOfferingType; input: SetCertificateAssignmentInput }) =>
      certificateAssignmentsApi.set(vars.offeringType, vars.input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: certificateAssignmentsKeys.all });
    },
  });
};

export const useClearCertificateAssignment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (offeringType: CertOfferingType) => certificateAssignmentsApi.clear(offeringType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: certificateAssignmentsKeys.all });
    },
  });
};
