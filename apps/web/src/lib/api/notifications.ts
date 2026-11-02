import { apiGet, apiPut, apiDelete } from "./api-client";

export type MemberNotificationType =
  | "BOOKING_CONFIRMED"
  | "BOOKING_REMINDER"
  | "BOOKING_CANCELLED"
  | "BOOKING_RESCHEDULED"
  | "PURCHASE_CONFIRMED"
  | "DM_REPLIED"
  | "ENROLLMENT_NEW"
  | "LESSON_PUBLISHED"
  | "ASSIGNMENT_GRADED"
  | "CERTIFICATE_AVAILABLE"
  | "SYSTEM"
  | "WORKSHOP_NEW_SESSION"
  | "DM_NEW_MESSAGE"
  | "DM_THREAD_CLOSED"
  | "CAMPAIGN";

export interface MemberNotification {
  id: string;
  tenantId: string;
  memberId: string;
  type: MemberNotificationType;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberNotificationsListResponse {
  notifications: MemberNotification[];
  total: number;
  page: number;
  limit: number;
}

export interface NotificationsParams {
  page?: number;
  limit?: number;
  type?: MemberNotificationType;
  isRead?: boolean;
}

export const listNotifications = (params?: NotificationsParams) =>
  apiGet<MemberNotificationsListResponse>("/notifications", { params });

export const getUnreadCount = () =>
  apiGet<{ count: number }>("/notifications/unread-count");

export const markNotificationRead = (id: string) =>
  apiPut<MemberNotification>(`/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
  apiPut<null>("/notifications/read-all");

export const deleteNotification = (id: string) =>
  apiDelete<null>(`/notifications/${id}`);
