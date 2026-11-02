"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import {
  Eye,
  Clock,
  MapPin,
  Monitor,
  Smartphone,
  Tablet,
  ArrowRight,
  Video,
} from "lucide-react";

import type { UserSessionItem, LocationItem, DeviceItem, ReferrerItem } from "@/lib/api/dashboard";

/* ------------------------------------------------------------------ */
/*  Formatters                                                         */
/* ------------------------------------------------------------------ */

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export function tryPathname(url: string): string {
  try {
    const path = new URL(url).pathname;
    // Normalize /home to / for display (home is only served at root)
    return path === "/home" || path === "/home/" ? "/" : path;
  } catch {
    return url || "-";
  }
}

export function getDeviceIcon(deviceType: string) {
  const lower = deviceType.toLowerCase();
  if (lower.includes("mobile") || lower.includes("phone")) return Smartphone;
  if (lower.includes("tablet")) return Tablet;
  return Monitor;
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Breakdown Bar                                                      */
/* ------------------------------------------------------------------ */

export function BreakdownBar({
  label,
  count,
  maxCount,
}: {
  label: string;
  count: number;
  maxCount: number;
}) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-muted-foreground ml-2">
          {count.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  List Card                                                          */
/* ------------------------------------------------------------------ */

export function ListCard({
  title,
  description,
  icon: Icon,
  items,
  emptyMessage,
  renderItem,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  items: Array<{ label: string; value: number }>;
  emptyMessage: string;
  renderItem?: (
    item: { label: string; value: number },
    index: number
  ) => React.ReactNode;
}) {
  const maxCount = items.reduce((sum, i) => sum + i.value, 0);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {description && (
            <CardDescription className="text-xs">{description}</CardDescription>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {renderItem
              ? items.map((item, i) => renderItem(item, i))
              : items.map((item, i) => (
                  <BreakdownBar
                    key={i}
                    label={item.label}
                    count={item.value}
                    maxCount={maxCount}
                  />
                ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {emptyMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Session Row                                                        */
/* ------------------------------------------------------------------ */

export function SessionRow({ session }: { session: UserSessionItem }) {
  const DevIcon = getDeviceIcon(session.device_type);
  const location =
    session.city !== "Unknown"
      ? `${session.city}, ${session.country}`
      : session.country !== "Unknown"
        ? session.country
        : "-";

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-3.5 w-3.5 text-muted-foreground" />
          <span
            className="font-mono text-xs text-muted-foreground truncate max-w-[120px]"
            title={session.session_id}
          >
            {session.session_id.slice(0, 8)}...
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatTimeAgo(session.start_time)}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className="font-mono truncate max-w-[160px]"
          title={session.distinct_id}
        >
          {session.distinct_id.includes(":")
            ? session.distinct_id.split(":")[1]?.slice(0, 8)
            : session.distinct_id.slice(0, 8)}
          ...
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(session.duration_seconds)}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" />
          {session.page_count} pages
        </span>
        {location !== "-" && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {location}
          </span>
        )}
        <span className="flex items-center gap-1">
          <DevIcon className="h-3 w-3" />
          {session.browser} / {session.os}
        </span>
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="truncate max-w-[140px]" title={session.entry_url}>
          {tryPathname(session.entry_url)}
        </span>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <span className="truncate max-w-[140px]" title={session.exit_url}>
          {tryPathname(session.exit_url)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Entity Breakdown Grid (locations, browsers, OS, devices, referrers)*/
/* ------------------------------------------------------------------ */

export function EntityBreakdownGrid({
  locations,
  browsers,
  operatingSystems,
  deviceTypes,
  referrers,
}: {
  locations: LocationItem[];
  browsers: DeviceItem[];
  operatingSystems: DeviceItem[];
  deviceTypes: DeviceItem[];
  referrers: ReferrerItem[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <ListCard
        title="Locations"
        description="Top countries & cities"
        icon={MapPin}
        items={locations.map((l) => ({
          label:
            l.city !== "Unknown" ? `${l.city}, ${l.country}` : l.country,
          value: l.count,
        }))}
        emptyMessage="No location data yet"
      />
      <ListCard
        title="Browsers"
        icon={Monitor}
        items={browsers.map((b) => ({ label: b.name, value: b.count }))}
        emptyMessage="No browser data yet"
      />
      <ListCard
        title="Operating Systems"
        icon={Monitor}
        items={operatingSystems.map((o) => ({
          label: o.name,
          value: o.count,
        }))}
        emptyMessage="No OS data yet"
      />
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-sm font-medium">Device Types</CardTitle>
            <CardDescription className="text-xs">
              Desktop vs Mobile vs Tablet
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {deviceTypes.length > 0 ? (
            <div className="space-y-3">
              {deviceTypes.map((d, i) => {
                const DevIcon = getDeviceIcon(d.name);
                const total = deviceTypes.reduce((s, x) => s + x.count, 0);
                const pct =
                  total > 0 ? Math.round((d.count / total) * 100) : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <DevIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{d.name}</span>
                        <span className="text-muted-foreground">
                          {d.count.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No device data yet
            </p>
          )}
        </CardContent>
      </Card>
      {referrers.length > 0 && (
        <ListCard
          title="Traffic Sources"
          icon={ArrowRight}
          items={referrers.map((r) => ({
            label: r.domain,
            value: r.count,
          }))}
          emptyMessage="No referrer data yet"
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sessions Grid                                                      */
/* ------------------------------------------------------------------ */

export function SessionsGrid({
  sessions,
  emptyMessage = "No session data yet",
}: {
  sessions: UserSessionItem[];
  emptyMessage?: string;
}) {
  return sessions.length > 0 ? (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[600px] overflow-y-auto">
      {sessions.map((session, i) => (
        <SessionRow key={i} session={session} />
      ))}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground py-4 text-center">
      {emptyMessage}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Daily Views Mini Chart                                             */
/* ------------------------------------------------------------------ */

/** Format date for label: YYYY-MM-DD -> MM-DD */
function formatDateLabel(dateStr: string): string {
  const part = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.slice(0, 10);
  return part.length >= 10 ? part.slice(5) : part;
}

export function DailyViewsChart({
  data,
}: {
  data: Array<{ date: string; count: number }>;
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No daily view data yet
      </p>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const showLabels = data.length <= 15;
  const showEveryNthLabel = data.length > 15 ? Math.ceil(data.length / 7) : 1;

  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d, i) => {
        const pct = Math.max((d.count / maxVal) * 100, 2);
        const showLabel = showLabels || (showEveryNthLabel > 0 && i % showEveryNthLabel === 0);
        return (
          <div
            key={`${d.date}-${i}`}
            className="flex-1 flex flex-col items-center gap-1 min-w-0"
          >
            <div
              className="w-full min-h-[2px] rounded-t bg-primary/80 hover:bg-primary transition-colors"
              style={{ height: `${pct}%` }}
              title={`${d.date}: ${d.count} views`}
            />
            {showLabel && (
              <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                {formatDateLabel(d.date)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-16 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-32 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-6 bg-muted rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
