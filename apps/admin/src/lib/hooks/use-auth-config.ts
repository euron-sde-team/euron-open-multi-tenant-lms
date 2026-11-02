import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  authConfigApi,
  type AuthConfig,
  type SaveGoogleClientIdRequest,
  type UpdateAuthConfigRequest,
} from "../api/auth-config";

export const authConfigKeys = {
  all: ["auth-config"] as const,
  config: (tenantId: string) =>
    [...authConfigKeys.all, "config", tenantId] as const,
};

export const useAuthConfig = (tenantId: string | undefined) => {
  return useQuery<AuthConfig>({
    queryKey: authConfigKeys.config(tenantId ?? ""),
    queryFn: () => authConfigApi.getConfig(),
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  });
};

export const useUpdateAuthConfig = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateAuthConfigRequest) =>
      authConfigApi.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: authConfigKeys.config(tenantId ?? ""),
      });
    },
  });
};

export const useSaveGoogleClientId = (
  tenantId: string | undefined
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveGoogleClientIdRequest) =>
      authConfigApi.saveGoogleClientId(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: authConfigKeys.config(tenantId ?? ""),
      });
    },
  });
};

export const useClearGoogleClientId = (
  tenantId: string | undefined
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authConfigApi.clearGoogleClientId(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: authConfigKeys.config(tenantId ?? ""),
      });
    },
  });
};
