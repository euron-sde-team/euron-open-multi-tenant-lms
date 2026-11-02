import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "../controllers/member-notification.controller";

const memberNotificationRouter: Router = Router();

// Auth is applied by v1.route.ts before mounting this router
memberNotificationRouter.get("/", asyncHandler(listNotifications));
memberNotificationRouter.get("/unread-count", asyncHandler(getUnreadCount));
memberNotificationRouter.put("/:id/read", asyncHandler(markNotificationRead));
memberNotificationRouter.put("/read-all", asyncHandler(markAllNotificationsRead));
memberNotificationRouter.delete("/:id", asyncHandler(deleteNotification));

export default memberNotificationRouter;
