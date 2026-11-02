"use client";

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@open-mtlms/core";

import type { RecentEnrollment } from "../../lib/types/dashboard";

interface RecentEnrollmentsCardProps {
  enrollments: RecentEnrollment[];
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    PURCHASED: "Purchased",
    FREE: "Free",
    ADMIN_GRANT: "Granted",
    BUNDLE: "Bundle",
    COUPON: "Coupon",
  };
  return map[source] ?? source;
}

function sourceVariant(source: string) {
  if (source === "PURCHASED") return "default" as const;
  if (source === "FREE" || source === "ADMIN_GRANT") return "secondary" as const;
  return "outline" as const;
}

export function RecentEnrollmentsCard({
  enrollments,
}: RecentEnrollmentsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Enrollments</CardTitle>
        <CardDescription>Latest student enrollments</CardDescription>
      </CardHeader>
      <CardContent>
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No enrollments yet
          </p>
        ) : (
          <div className="space-y-4">
            {enrollments.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {e.member_name || e.member_email || "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {e.course_title}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant={sourceVariant(e.source)} className="text-[10px] px-1.5 py-0">
                    {sourceLabel(e.source)}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {formatTimeAgo(e.enrolled_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
