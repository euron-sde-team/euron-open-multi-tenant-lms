"use client";

import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@open-mtlms/core";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ScrollText,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { AuditLog, AuditLogFilters } from "../../../../lib/api/audit";
import {
  useAuditFilterOptions,
  useAuditLogs,
} from "../../../../lib/hooks/use-audit";
import { cn } from "../../../../lib/utils";

const PAGE_SIZE = 50;

/**
 * How far back to look.
 *
 * This replaced a pair of native `<input type="date">` fields. Those are drawn
 * by the browser, not by us: two `dd/mm/yyyy` placeholders and two grey calendar
 * glyphs that no amount of CSS makes sit well beside the themed pills next to
 * them. And they answered a question nobody asks of an activity log, the real
 * question is "what happened lately?", not "what happened between the 3rd and
 * the 11th".
 *
 * A preset is one control, it matches the other filters exactly, and it is the
 * thing people actually reach for.
 */
const RANGES = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 3 months" },
] as const;

/** Days back → the ISO instant to filter from. */
function since(days: string): string {
  const d = new Date();
  d.setDate(d.getDate() - Number(days));
  return d.toISOString();
}

export default function ActivityLogPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: PAGE_SIZE,
  });

  const { data, isLoading, isFetching } = useAuditLogs(filters);
  const { data: options } = useAuditFilterOptions();

  const logs = data?.logs ?? [];
  const pagination = data?.pagination;

  /** Any filter change resets to page 1, otherwise you land on an empty page 7. */
  function setFilter(patch: Partial<AuditLogFilters>) {
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  }

  const hasFilters = useMemo(
    () =>
      !!(
        filters.actorUserId ||
        filters.category ||
        filters.search ||
        filters.days ||
        filters.succeeded !== undefined
      ),
    [filters]
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Everything your team has done in the dashboard, who did it, what
            they touched, and when. Blocked attempts are recorded too.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCsv(logs)}
          disabled={logs.length === 0}
        >
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.search ?? ""}
            onChange={(e) => setFilter({ search: e.target.value || undefined })}
            placeholder="Search what happened…"
            className="h-9 w-full rounded-lg bg-muted px-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>

        <FilterSelect
          value={filters.actorUserId ?? ""}
          onChange={(v) => setFilter({ actorUserId: v || undefined })}
          placeholder="Anyone"
          options={(options?.actors ?? []).map((a) => ({
            value: a.id,
            label: a.name || a.email || "Unknown",
          }))}
        />

        <FilterSelect
          value={filters.category ?? ""}
          onChange={(v) => setFilter({ category: v || undefined })}
          placeholder="All modules"
          options={(options?.categories ?? []).map((c) => ({
            value: c,
            label: c,
          }))}
        />

        <FilterSelect
          value={
            filters.succeeded === undefined ? "" : String(filters.succeeded)
          }
          onChange={(v) =>
            setFilter({ succeeded: v === "" ? undefined : v === "true" })
          }
          placeholder="Everything"
          options={[
            { value: "true", label: "Successful only" },
            { value: "false", label: "Blocked only" },
          ]}
        />

        <FilterSelect
          value={filters.days ?? ""}
          onChange={(v) =>
            setFilter({ days: v || undefined, from: v ? since(v) : undefined })
          }
          placeholder="Any time"
          options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
        />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ page: 1, limit: PAGE_SIZE })}
          >
            Clear
          </Button>
        )}
      </div>

      {/* The log */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg bg-muted/40 py-20 text-center">
          <ScrollText className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium text-foreground">
            {hasFilters ? "Nothing matches those filters" : "No activity yet"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {hasFilters
              ? "Try widening the date range or clearing a filter."
              : "As soon as your team creates a course, refunds an order or changes someone's access, it will show up here."}
          </p>
        </div>
      ) : (
        <div
          className={cn(
            "space-y-1 transition-opacity",
            isFetching && "opacity-60"
          )}
        >
          {logs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {pagination.total.toLocaleString()} entries · page{" "}
            {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() =>
                setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!log.metadata && Object.keys(log.metadata).length > 0;

  return (
    <div
      className={cn(
        "rounded-lg px-4 py-3 transition-colors",
        log.succeeded
          ? "bg-muted/40 hover:bg-muted"
          : "bg-red-50 dark:bg-red-950/30"
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={log.actor_name} blocked={!log.succeeded} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm text-foreground">{log.summary}</p>
            {!log.succeeded && (
              <Badge variant="destructive" className="text-[10px]">
                Blocked
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatWhen(log.created_at)}
            {" · "}
            {log.category}
            {log.browser && ` · ${log.browser} on ${log.os}`}
            {log.ip_address && ` · ${log.ip_address}`}
          </p>

          {open && hasDetail && <Details metadata={log.metadata!} />}
        </div>

        {hasDetail && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            {open ? "Hide" : "Details"}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * What changed, as a small table.
 *
 * This used to be `JSON.stringify(metadata)`, which showed an owner
 * `{"roleIds": ["01KXE08A4KTQQ19VKFJ5AGMQ9Y"]}`, a database id, in a log meant
 * for people. The server now labels the fields and swaps ids for names, so all
 * that is left here is to lay them out.
 */
/**
 * An internal identifier, a ULID, or one of our dotted codes like
 * `courses.publish`. Neither means anything to the person reading this log, and
 * showing one looks like a leak. Anything matching is dropped rather than shown.
 */
function isRawId(v: unknown): boolean {
  if (typeof v !== "string") return false;
  return (
    /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(v) || // ULID
    /^[a-z0-9_]+\.[a-z0-9_.]+$/i.test(v) // courses.publish, hub.dms.respond
  );
}

/** "roleIds" → "Roles"; "capabilityIds" → "Capabilities"; "is_published" → "Is published". */
function humaniseKey(key: string): string {
  // Drop the Id/Ids suffix FIRST, then pluralise properly, naively appending
  // "s" to "capability" gives "Capabilitys".
  const plural = /Ids$/i.test(key);
  let word = key
    .replace(/Ids?$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();

  if (plural) word = word.endsWith("y") ? word.slice(0, -1) + "ies" : word + "s";

  return word.charAt(0).toUpperCase() + word.slice(1);
}

function Details({ metadata }: { metadata: Record<string, unknown> }) {
  const changes = (metadata.changes ?? {}) as Record<string, unknown>;
  const denied = metadata.denied === true;

  // The server humanises what it writes, but rows written BEFORE that shipped
  // still hold raw keys and raw ids. Clean them up here too, so the whole log
  // reads the same, and drop anything that is still just an internal id, which
  // tells a reader nothing and only makes them distrust the rest.
  const rows = Object.entries(changes)
    .map(([k, v]) => {
      const values = Array.isArray(v) ? v : [v];
      const readable = values.filter((x) => !isRawId(x));
      if (readable.length === 0) return null; // nothing but ids, say nothing
      return [humaniseKey(k), readable] as const;
    })
    .filter((r): r is readonly [string, unknown[]] => r !== null);

  return (
    <div className="mt-2 rounded-lg bg-background/60 p-3">
      {denied && (
        <p className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">
          This action was blocked, the person&apos;s role doesn&apos;t allow it.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing more to show, the summary above says what changed.
        </p>
      ) : (
        <dl className="space-y-1.5">
          {rows.map(([key, values]) => (
            <div key={key} className="flex gap-3 text-xs">
              <dt className="w-32 shrink-0 text-muted-foreground">{key}</dt>
              <dd className="min-w-0 flex-1 break-words text-foreground">
                {values.map(renderValue).join(", ")}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Booleans and nested objects still need to read like something. */
function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(renderValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function Avatar({
  name,
  blocked,
}: {
  name: string | null;
  blocked: boolean;
}) {
  if (blocked) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
        <ShieldAlert className="h-4 w-4" />
      </div>
    );
  }
  const initials = (name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-muted-foreground">
      {initials || "?"}
    </div>
  );
}

/**
 * "No filter" needs a value Radix will accept, it forbids "" on an item,
 * because an empty value is how it represents "nothing selected".
 */
const ANY = "__any__";

/**
 * A filter dropdown.
 *
 * Uses the app's own Select (Radix) rather than a native `<select>`. A native
 * one is rendered by the OS, so it ignores the theme entirely: on a dark page
 * you get a white popup with a blue system highlight. Themed pages need themed
 * controls.
 */
function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select
      value={value || ANY}
      onValueChange={(v) => onChange(v === ANY ? "" : v)}
    >
      <SelectTrigger className={cn("h-9 w-[150px]", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** "2 hours ago" beats a timestamp for the recent stuff people actually scan. */
function formatWhen(iso: string): string {
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) {
    const h = Math.round(mins / 60);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  return then.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Export what's on screen. The owner's evidence, in a form they can send on. */
/**
 * Export what's on screen, the owner's evidence, in a form they can send on.
 *
 * Written for a PERSON opening it in Excel, not for a developer. The first
 * version leaked our internals straight into the sheet: an "Action" column of
 * `staff.roles.assign`, an ISO timestamp, `::1` for the IP, and Who/Email
 * duplicated by a "What happened" that already began with the person's name.
 * None of that helps someone answer "who unpublished my course?".
 */
function downloadCsv(logs: AuditLog[]) {
  const header = [
    "Date",
    "Time",
    "Who",
    "Email",
    "What happened",
    "Details",
    "Module",
    "Outcome",
  ];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const rows = logs.map((l) => {
    const when = new Date(l.created_at);

    // The same cleanup the Details panel does: English labels, no internal ids.
    const changes = (l.metadata?.changes ?? {}) as Record<string, unknown>;
    const details = Object.entries(changes)
      .map(([k, v]) => {
        const values = (Array.isArray(v) ? v : [v]).filter((x) => !isRawId(x));
        if (values.length === 0) return null;
        return `${humaniseKey(k)}: ${values.map(renderValue).join(", ")}`;
      })
      .filter(Boolean)
      .join("; ");

    return [
      when.toLocaleDateString(),
      when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      l.actor_name,
      l.actor_email,
      l.summary,
      details,
      l.category,
      l.succeeded ? "Allowed" : "Blocked",
    ]
      .map(escape)
      .join(",");
  });

  // The BOM is what makes Excel open a UTF-8 CSV without mangling accents.
  const blob = new Blob(
    ["\uFEFF" + [header.map(escape).join(","), ...rows].join("\n")],
    { type: "text/csv;charset=utf-8;" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
