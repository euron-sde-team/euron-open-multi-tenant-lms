"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { organizationApi, type CreateOrganizationPayload } from "../api/organization";

import { authKeys } from "./use-auth";

/**
 * Hook for creating an organization. Backwards-compatible, bare calls with
 * `{ name }` keep working. Pass `quiz_answers` (and optional `timezone`) to
 * trigger the auto-provisioning flow (template + theme + AI hero + sample
 * DRAFT course + 5 page seeds + subdomain registration).
 *
 * On success, invalidates the /me query to refresh the tenant store.
 */
export const useCreateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrganizationPayload) =>
      organizationApi.createOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
};

/**
 * Hook for updating organization name (owner only)
 * On success, invalidates /me to refresh tenant name + slug in store
 */
export const useUpdateOrgName = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => organizationApi.updateName(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
};
