"use client";

import React from "react";
import {
  Bell,
  Calendar,
  Mail,
  ShoppingBag,
  MessageSquare,
  BookOpen,
  Award,
  Info,
} from "lucide-react";
import { cn, decodeHtmlEntities } from "@/lib/utils";
import {
  useUnreadNotificationCount,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/lib/hooks/use-notifications";
import type { MemberNotificationType } from "@/lib/api/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.round((then - now) / 1000);
  if (Math.abs(diffSec) < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return relativeFormatter.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return relativeFormatter.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return relativeFormatter.format(diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth === 0) return relativeFormatter.format(diffDay, "day");
  const diffYear = Math.round(diffDay / 365);
  if (Math.abs(diffMonth) < 12) return relativeFormatter.format(diffMonth, "month");
  return relativeFormatter.format(diffYear, "year");
}

function getIcon(type: MemberNotificationType) {
  const cls = "h-4 w-4 shrink-0";
  switch (type) {
    case "BOOKING_CONFIRMED":
    case "BOOKING_REMINDER":
    case "BOOKING_CANCELLED":
    case "BOOKING_RESCHEDULED":
      return <Calendar className={cn(cls, "text-blue-500")} />;
    case "PURCHASE_CONFIRMED":
      return <ShoppingBag className={cn(cls, "text-green-500")} />;
    case "DM_REPLIED":
      return <MessageSquare className={cn(cls, "text-purple-500")} />;
    case "ENROLLMENT_NEW":
    case "LESSON_PUBLISHED":
    case "ASSIGNMENT_GRADED":
      return <BookOpen className={cn(cls, "text-orange-500")} />;
    case "CERTIFICATE_AVAILABLE":
      return <Award className={cn(cls, "text-yellow-500")} />;
    case "CAMPAIGN":
      return <Mail className={cn(cls, "text-indigo-500")} />;
    default:
      return <Info className={cn(cls, "text-muted-foreground")} />;
  }
}

export function NotificationBell() {
  const { data: countData } = useUnreadNotificationCount();
  const { data: notificationsData } = useNotifications({ limit: 10 });
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  const unreadCount = countData?.count ?? 0;
  const notifications = notificationsData?.notifications ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-transparent hover:text-current">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <button
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
              onClick={() => markAllRead()}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
          {notifications.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center text-sm">
              No notifications yet
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "hover:bg-muted/50 flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors",
                    !n.isRead && "bg-primary/5"
                  )}
                  onClick={() => !n.isRead && markRead(n.id)}
                >
                  <div className="mt-0.5">{getIcon(n.type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{decodeHtmlEntities(n.title)}</p>
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                      {decodeHtmlEntities(n.message)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      {getRelativeTime(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="bg-primary mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
