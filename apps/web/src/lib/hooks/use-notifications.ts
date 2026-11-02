import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type NotificationsParams,
} from "../api/notifications";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...notificationKeys.all, "list", filters] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

export function useNotifications(params?: NotificationsParams) {
  return useQuery({
    queryKey: notificationKeys.list(params as Record<string, unknown>),
    queryFn: () => listNotifications(params),
    placeholderData: keepPreviousData,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
