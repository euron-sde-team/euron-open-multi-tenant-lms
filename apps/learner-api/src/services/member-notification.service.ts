import memberNotificationRepository, {
  type CreateMemberNotificationData,
  type MemberNotificationsListParams,
  type MemberNotificationRow,
} from "../repositories/member-notification.repository";
import { NotFoundError } from "../errors/not-found.error";
import type { member_notification_type } from "../db/enums";
import logger from "../utils/logger";

export interface CreateMemberNotificationParams {
  type: member_notification_type;
  title: string;
  message: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListMemberNotificationsResult {
  notifications: MemberNotificationRow[];
  total: number;
  page: number;
  limit: number;
}

class MemberNotificationService {
  async createNotification(
    tenantId: string,
    memberId: string,
    params: CreateMemberNotificationParams
  ): Promise<MemberNotificationRow> {
    const data: CreateMemberNotificationData = {
      tenant_id: tenantId,
      member_id: memberId,
      type: params.type,
      title: params.title,
      message: params.message,
      action_url: params.actionUrl ?? null,
      metadata: params.metadata ?? null,
    };
    const notification = await memberNotificationRepository.create(data);

    return notification;
  }

  async listNotifications(
    tenantId: string,
    memberId: string,
    params: MemberNotificationsListParams
  ): Promise<ListMemberNotificationsResult> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const { items, total } = await memberNotificationRepository.findAll(
      tenantId,
      memberId,
      params
    );
    return { notifications: items, total, page, limit };
  }

  async getUnreadCount(tenantId: string, memberId: string): Promise<number> {
    return memberNotificationRepository.countUnread(tenantId, memberId);
  }

  async markAsRead(
    tenantId: string,
    memberId: string,
    id: string
  ): Promise<MemberNotificationRow> {
    const notification = await memberNotificationRepository.markRead(
      tenantId,
      memberId,
      id
    );
    if (!notification) {
      throw new NotFoundError("Notification not found");
    }
    return notification;
  }

  async markAllAsRead(tenantId: string, memberId: string): Promise<void> {
    await memberNotificationRepository.markAllRead(tenantId, memberId);
  }

  async deleteNotification(
    tenantId: string,
    memberId: string,
    id: string
  ): Promise<void> {
    await memberNotificationRepository.deleteById(tenantId, memberId, id);
  }

  /** Fire-and-forget helper */
  createNotificationSilently(
    tenantId: string,
    memberId: string,
    params: CreateMemberNotificationParams
  ): void {
    this.createNotification(tenantId, memberId, params).catch((err: unknown) => {
      logger.warn(
        `[member-notifications] Failed to create notification (type=${params.type}): ${err instanceof Error ? err.message : String(err)}`
      );
    });
  }
}

export default new MemberNotificationService();
