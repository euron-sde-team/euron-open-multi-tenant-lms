import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  emailEngineApi,
  type CreateSenderIdentityInput,
  type ListMessagesParams,
  type ListSuppressionsParams,
  type OnboardSendingDomainInput,
  type SendingDomain,
  type UpdateSenderIdentityInput,
} from "../api/email-engine";

/**
 * Email engine React Query hooks: Phase 14.
 *
 * Cache keys are flat under `["email-engine", ...]` so a single
 * `invalidateQueries({ queryKey: ["email-engine"] })` blast-invalidates the
 * whole section after big mutations (delete domain, archive identity).
 */

export const emailEngineKeys = {
  all: ["email-engine"] as const,
  sendingDomains: () => [...emailEngineKeys.all, "sending-domains"] as const,
  sendingDomain: (id: string) =>
    [...emailEngineKeys.all, "sending-domains", id] as const,
  domainHealth: (id: string) =>
    [...emailEngineKeys.all, "sending-domains", id, "health"] as const,
  senderIdentities: () => [...emailEngineKeys.all, "sender-identities"] as const,
  reputation: () => [...emailEngineKeys.all, "reputation"] as const,
  suppressions: (params?: ListSuppressionsParams) =>
    [...emailEngineKeys.all, "suppressions", params ?? {}] as const,
  messages: (params?: ListMessagesParams) =>
    [...emailEngineKeys.all, "messages", params ?? {}] as const,
};

// ─── Sending domains ─────────────────────────────────────────

export const useSendingDomains = () =>
  useQuery({
    queryKey: emailEngineKeys.sendingDomains(),
    queryFn: emailEngineApi.listSendingDomains,
  });

export const useSendingDomain = (id: string | null) =>
  useQuery({
    queryKey: id ? emailEngineKeys.sendingDomain(id) : ["email-engine", "noop"],
    queryFn: () => emailEngineApi.getSendingDomain(id!),
    enabled: !!id,
  });

export const useOnboardSendingDomain = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OnboardSendingDomainInput) =>
      emailEngineApi.onboardSendingDomain(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: emailEngineKeys.sendingDomains() });
    },
  });
};

export const useDeleteSendingDomain = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emailEngineApi.deleteSendingDomain(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: emailEngineKeys.all });
    },
  });
};

export const useCheckSendingDomain = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emailEngineApi.checkSendingDomain(id),
    onSuccess: (updated: SendingDomain) => {
      qc.setQueryData<SendingDomain[]>(
        emailEngineKeys.sendingDomains(),
        (prev) => prev?.map((d) => (d.id === updated.id ? updated : d)) ?? [updated],
      );
      qc.setQueryData(emailEngineKeys.sendingDomain(updated.id), updated);
    },
  });
};

export const useDomainHealth = (id: string | null) =>
  useQuery({
    queryKey: id ? emailEngineKeys.domainHealth(id) : ["email-engine", "noop"],
    queryFn: () => emailEngineApi.getDomainHealth(id!),
    enabled: !!id,
  });

export const useRunDomainHealthCheck = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emailEngineApi.runDomainHealthCheck(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: emailEngineKeys.domainHealth(id) });
    },
  });
};

// ─── Sender identities ───────────────────────────────────────

export const useSenderIdentities = () =>
  useQuery({
    queryKey: emailEngineKeys.senderIdentities(),
    queryFn: emailEngineApi.listSenderIdentities,
  });

export const useCreateSenderIdentity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSenderIdentityInput) =>
      emailEngineApi.createSenderIdentity(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: emailEngineKeys.senderIdentities() });
    },
  });
};

export const useUpdateSenderIdentity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSenderIdentityInput }) =>
      emailEngineApi.updateSenderIdentity(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: emailEngineKeys.senderIdentities() });
    },
  });
};

export const useArchiveSenderIdentity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emailEngineApi.archiveSenderIdentity(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: emailEngineKeys.senderIdentities() });
    },
  });
};

// ─── Reputation ──────────────────────────────────────────────

export const useReputationOverview = () =>
  useQuery({
    queryKey: emailEngineKeys.reputation(),
    queryFn: emailEngineApi.getReputationOverview,
  });

// ─── Suppressions ────────────────────────────────────────────

export const useSuppressions = (params?: ListSuppressionsParams) =>
  useQuery({
    queryKey: emailEngineKeys.suppressions(params),
    queryFn: () => emailEngineApi.listSuppressions(params),
    placeholderData: keepPreviousData,
  });

export const useRemoveSuppression = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emailEngineApi.removeSuppression(id),
    onSuccess: () => {
      // Invalidate every suppressions cache (different param keys all
      // resolve to the same prefix).
      qc.invalidateQueries({
        queryKey: [...emailEngineKeys.all, "suppressions"],
      });
    },
  });
};

// ─── Messages log ────────────────────────────────────────────

export const useMessages = (params?: ListMessagesParams) =>
  useQuery({
    queryKey: emailEngineKeys.messages(params),
    queryFn: () => emailEngineApi.listMessages(params),
    placeholderData: keepPreviousData,
  });
