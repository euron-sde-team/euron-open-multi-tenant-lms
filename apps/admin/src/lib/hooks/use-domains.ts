import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { domainsApi } from "../api";
import type { CustomDomainResponse, Domain, DomainStatusResponse, SubdomainDeployResponse } from "../types";

export const domainsKeys = {
  all: ["domains"] as const,
  lists: () => [...domainsKeys.all, "list"] as const,
  list: () => [...domainsKeys.lists()] as const,
  details: () => [...domainsKeys.all, "detail"] as const,
  detail: (id: string) => [...domainsKeys.details(), id] as const,
  status: (id: string) => [...domainsKeys.all, "status", id] as const,
};

export function useDomains() {
  return useQuery({
    queryKey: domainsKeys.list(),
    queryFn: domainsApi.list,
  });
}

export function useDomain(id: string, enabled = true) {
  return useQuery({
    queryKey: domainsKeys.detail(id),
    queryFn: () => domainsApi.get(id),
    enabled: !!id && enabled,
  });
}

export function useDomainStatus(
  id: string,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) {
  return useQuery({
    queryKey: domainsKeys.status(id),
    queryFn: () => domainsApi.getStatus(id),
    enabled: options?.enabled ?? !!id,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export function useAddCustomDomain() {
  const queryClient = useQueryClient();

  return useMutation<CustomDomainResponse, Error, string>({
    mutationFn: (domain: string) => domainsApi.addCustomDomain(domain),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainsKeys.lists() });
    },
  });
}

export function useRemoveDomain() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id: string) => domainsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainsKeys.lists() });
    },
  });
}

export function useSetPrimaryDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => domainsApi.setPrimary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainsKeys.lists() });
    },
  });
}

export function useDeploySubdomain() {
  const queryClient = useQueryClient();

  return useMutation<SubdomainDeployResponse, Error, void>({
    mutationFn: () => domainsApi.deploySubdomain(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainsKeys.lists() });
    },
  });
}

export function useVerifyDomain() {
  const queryClient = useQueryClient();

  return useMutation<DomainStatusResponse, Error, string>({
    mutationFn: (id: string) => domainsApi.verify(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: domainsKeys.status(id) });
      queryClient.invalidateQueries({ queryKey: domainsKeys.lists() });
    },
  });
}

export function useRetryDomain() {
  const queryClient = useQueryClient();

  return useMutation<DomainStatusResponse, Error, string>({
    mutationFn: (id: string) => domainsApi.retry(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: domainsKeys.status(id) });
      queryClient.invalidateQueries({ queryKey: domainsKeys.lists() });
    },
  });
}

export function getDomainStatusInfo(status: Domain["status"]): {
  label: string;
  color: "default" | "secondary" | "destructive" | "outline";
  description: string;
} {
  switch (status) {
    case "ACTIVE":
      return {
        label: "Active",
        color: "default",
        description: "Domain is active and serving traffic",
      };
    case "PENDING_SSL":
      return {
        label: "Provisioning SSL",
        color: "secondary",
        description: "SSL certificate is being provisioned",
      };
    case "PENDING_VERIFICATION":
      return {
        label: "Verifying DNS",
        color: "secondary",
        description: "Add the DNS records below to verify domain ownership",
      };
    case "FAILED":
      return {
        label: "Failed",
        color: "destructive",
        description: "Domain configuration failed. Check DNS records and retry.",
      };
    case "REMOVING":
      return {
        label: "Removing",
        color: "outline",
        description: "Domain is being removed",
      };
    case "REDIRECT":
      return {
        label: "Redirects to www",
        color: "outline",
        description:
          "Your DNS provider doesn't support root domain CNAME records. Set up forwarding to www to fix this.",
      };
    default:
      return {
        label: status,
        color: "outline",
        description: "Unknown status",
      };
  }
}
