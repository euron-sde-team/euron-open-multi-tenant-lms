import { Request, Response } from "express";
import { UnauthorizedError } from "../errors/unauthorized.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import memberNotificationService from "../services/member-notification.service";
import type { member_notification_type } from "../db/enums";

function getContext(req: Request): { tenantId: string; memberId: string } {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new UnauthorizedError("Authentication required");
  return { tenantId, memberId };
}

export const listNotifications = async (req: Request, res: Response) => {
  const { tenantId, memberId } = getContext(req);
  const result = await memberNotificationService.listNotifications(tenantId, memberId, {
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    type: req.query.type as member_notification_type | undefined,
    isRead: req.query.isRead !== undefined ? req.query.isRead === "true" : undefined,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Notifications retrieved successfully",
  });
};

export const getUnreadCount = async (req: Request, res: Response) => {
  const { tenantId, memberId } = getContext(req);
  const count = await memberNotificationService.getUnreadCount(tenantId, memberId);
  sendSuccessResponse({
    res,
    data: { count },
    statusCode: HttpSuccessStatus.OK,
    message: "Unread count retrieved",
  });
};

export const markNotificationRead = async (req: Request, res: Response) => {
  const { tenantId, memberId } = getContext(req);
  const id = req.params.id as string;
  const notification = await memberNotificationService.markAsRead(tenantId, memberId, id);
  sendSuccessResponse({
    res,
    data: notification,
    statusCode: HttpSuccessStatus.OK,
    message: "Notification marked as read",
  });
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  const { tenantId, memberId } = getContext(req);
  await memberNotificationService.markAllAsRead(tenantId, memberId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "All notifications marked as read",
  });
};

export const deleteNotification = async (req: Request, res: Response) => {
  const { tenantId, memberId } = getContext(req);
  const id = req.params.id as string;
  await memberNotificationService.deleteNotification(tenantId, memberId, id);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Notification deleted",
  });
};
