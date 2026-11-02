import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  paymentApi,
  paymentConfigApi,
  type CreateGatewayConnectionBody,
  type GatewayConnectionResponse,
  type UpdateGatewayConnectionBody,
} from "../api/payment";

export const paymentKeys = {
  config: ["payment", "config"] as const,
  providers: ["payment", "providers"] as const,
  connections: ["payment", "connections"] as const,
  connection: (id: string) => ["payment", "connection", id] as const,
};

export function usePaymentConfig() {
  return useQuery({
    queryKey: paymentKeys.config,
    queryFn: () => paymentConfigApi.getConfig(),
  });
}

export function usePaymentProviders() {
  return useQuery({
    queryKey: paymentKeys.providers,
    queryFn: () => paymentApi.listProviders(),
  });
}

export function useGatewayConnections() {
  return useQuery({
    queryKey: paymentKeys.connections,
    queryFn: () => paymentApi.listConnections(),
  });
}

export function useGatewayConnection(id: string | undefined) {
  return useQuery({
    queryKey: paymentKeys.connection(id ?? ""),
    queryFn: () => paymentApi.getConnection(id!),
    enabled: !!id,
  });
}

export function useCreateGatewayConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGatewayConnectionBody) => paymentApi.createConnection(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.connections });
    },
  });
}

export function useUpdateGatewayConnection(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateGatewayConnectionBody) => paymentApi.updateConnection(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.connections });
      queryClient.invalidateQueries({ queryKey: paymentKeys.connection(id) });
    },
  });
}

export function useToggleGatewayConnectionActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      paymentApi.updateConnection(id, { is_active }),
    onMutate: async ({ id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: paymentKeys.connections });
      const previous = queryClient.getQueryData<GatewayConnectionResponse[]>(
        paymentKeys.connections
      );
      if (previous) {
        queryClient.setQueryData<GatewayConnectionResponse[]>(
          paymentKeys.connections,
          previous.map((c) => ({
            ...c,
            is_active: c.id === id ? is_active : is_active ? false : c.is_active,
            status: c.id === id
              ? is_active ? "ACTIVE" : "PENDING"
              : is_active ? "PENDING" : c.status,
          }))
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(paymentKeys.connections, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.connections });
    },
  });
}

export function useDeleteGatewayConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentApi.deleteConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.connections });
    },
  });
}
