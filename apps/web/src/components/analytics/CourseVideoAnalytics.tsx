"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@open-mtlms/core";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Gauge,
  Loader2,
  Play,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useCourseVideoAnalytics } from "@/lib/hooks/use-course-video-analytics";
import { useMemberAnalytics } from "@/lib/hooks/use-member-analytics";
import type { CourseVideoAnalyticsVideo } from "@/lib/api/course-video-analytics";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a duration in seconds as "Xh Ym" / "Xm" / "<1m". */
function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return s === 0 ? "0m" : "<1m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** Short label for chart axes ("12m", "1.5h"). */
function formatShort(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const mins = s / 60;
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${(mins / 60).toFixed(1)}h`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  compare,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  compare?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-[11px] font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {compare && <div className="mt-1 text-xs">{compare}</div>}
    </div>
  );
}

/** Coloured delta vs the cohort average, e.g. "50% above avg". */
function AvgDelta({
  yours,
  avg,
  unit = "time",
}: {
  yours: number;
  avg: number;
  unit?: "time" | "percent";
}) {
  if (avg <= 0) {
    return <span className="text-muted-foreground">No average yet</span>;
  }
  const diffPct = Math.round(((yours - avg) / avg) * 100);
  if (diffPct === 0) {
    return <span className="text-muted-foreground">On par with avg</span>;
  }
  const above = diffPct > 0;
  const avgLabel = unit === "time" ? formatDuration(avg) : `${Math.round(avg)}%`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        above ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
      )}
    >
      {above ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(diffPct)}% {above ? "above" : "below"} avg
      <span className="text-muted-foreground">({avgLabel})</span>
    </span>
  );
}

const ChartTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-semibold">{formatDuration(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

/** Donut showing completed vs remaining videos with a centred percentage. */
function CompletionDonut({ done, total }: { done: number; total: number }) {
  const remaining = Math.max(0, total - done);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const chartData = [
    { name: "Completed", value: done },
    { name: "Remaining", value: remaining },
  ];
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Completion
      </p>
      <div className="relative" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={78}
              startAngle={90}
              endAngle={-270}
              paddingAngle={total > 0 ? 2 : 0}
              stroke="none"
            >
              <Cell fill="hsl(var(--primary))" />
              <Cell fill="hsl(var(--muted))" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground">{pct}%</span>
          <span className="text-xs text-muted-foreground">
            {done}/{total} done
          </span>
        </div>
      </div>
    </div>
  );
}

/** One step in the course-journey timeline: status node + connector + comparison. */
function VideoStep({
  video,
  index,
  isLast,
  hasPeers,
}: {
  video: CourseVideoAnalyticsVideo;
  index: number;
  isLast: boolean;
  hasPeers: boolean;
}) {
  const max = Math.max(video.yourSeconds, video.avgSeconds, 1);
  const yourPct = (video.yourSeconds / max) * 100;
  const avgPct = (video.avgSeconds / max) * 100;
  const status = video.yourCompleted
    ? "done"
    : video.yourSeconds > 0
      ? "started"
      : "todo";

  return (
    <div className="flex gap-3">
      {/* ── Timeline rail: node + connector ── */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-transform",
            status === "done" && "bg-emerald-500 text-white shadow-sm",
            status === "started" && "border-2 border-primary bg-primary/10 text-primary",
            status === "todo" && "border border-border bg-muted/40 text-muted-foreground/60"
          )}
        >
          {status === "done" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : status === "started" ? (
            <Play className="h-4 w-4 fill-current" />
          ) : (
            index + 1
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-0.5 flex-1",
              status === "done" ? "bg-emerald-500/40" : "bg-border"
            )}
          />
        )}
      </div>

      {/* ── Step card ── */}
      <div className="mb-2 flex-1 rounded-lg border bg-card px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{video.title}</p>
            {video.sectionTitle && (
              <p className="truncate text-xs text-muted-foreground">{video.sectionTitle}</p>
            )}
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              status === "done" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              status === "started" && "bg-primary/15 text-primary",
              status === "todo" && "bg-muted text-muted-foreground"
            )}
          >
            {status === "done" ? "Completed" : status === "started" ? "In progress" : "Not started"}
          </span>
        </div>

      {/* Your time bar */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[11px] font-medium text-primary">You</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${yourPct}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-[11px] font-semibold text-foreground">
            {formatDuration(video.yourSeconds)}
          </span>
        </div>

        {/* Average time bar */}
        {hasPeers && (
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] font-medium text-muted-foreground">
              Average
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-muted-foreground/50 transition-all"
                style={{ width: `${avgPct}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-[11px] font-semibold text-muted-foreground">
              {formatDuration(video.avgSeconds)}
            </span>
          </div>
        )}
      </div>

      {/* Footer: delta + peer completion */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        {hasPeers ? (
          <AvgDelta yours={video.yourSeconds} avg={video.avgSeconds} unit="time" />
        ) : (
          <span className="text-muted-foreground">{formatDuration(video.yourSeconds)} watched</span>
        )}
        {hasPeers && (
          <span className="text-muted-foreground">
            {Math.round(video.peerCompletionPercent)}% of learners completed
          </span>
        )}
      </div>
      </div>
    </div>
  );
}

/** Auto-generated insight tiles derived from the analytics, the "advanced" layer. */
function InsightStrip({
  videos,
  yourTotal,
  avgTotal,
  hasPeers,
}: {
  videos: CourseVideoAnalyticsVideo[];
  yourTotal: number;
  avgTotal: number;
  hasPeers: boolean;
}) {
  const insights = useMemo(() => {
    const out: Array<{ icon: React.ElementType; title: string; detail: string; tone: "neutral" | "good" | "warn" }> = [];

    // 1. Video the learner spends the most time on.
    const watched = videos.filter((v) => v.yourSeconds > 0);
    if (watched.length > 0) {
      const top = watched.reduce((a, b) => (b.yourSeconds > a.yourSeconds ? b : a));
      out.push({
        icon: Clock,
        title: "Most time spent",
        detail: `${top.title}, ${formatDuration(top.yourSeconds)}`,
        tone: "neutral",
      });
    }

    if (hasPeers) {
      // 2. How many videos the learner is at/above the cohort average on.
      const compared = videos.filter((v) => v.avgSeconds > 0);
      const aboveOrEqual = compared.filter((v) => v.yourSeconds >= v.avgSeconds).length;
      if (compared.length > 0) {
        out.push({
          icon: Target,
          title: "Engagement vs peers",
          detail: `At or above average on ${aboveOrEqual} of ${compared.length} videos`,
          tone: aboveOrEqual >= compared.length / 2 ? "good" : "warn",
        });
      }

      // 3. Overall pace vs the cohort.
      if (avgTotal > 0) {
        const diff = Math.round(((yourTotal - avgTotal) / avgTotal) * 100);
        out.push({
          icon: Gauge,
          title: "Overall pace",
          detail:
            diff === 0
              ? "Right on the cohort average"
              : diff > 0
                ? `${diff}% more watch time than average`
                : `${Math.abs(diff)}% less watch time than average`,
          tone: "neutral",
        });
      }
    }

    return out;
  }, [videos, yourTotal, avgTotal, hasPeers]);

  if (insights.length === 0) return null;

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" /> Insights
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {insights.map((ins) => (
          <div
            key={ins.title}
            className={cn(
              "rounded-xl border bg-card p-3.5",
              ins.tone === "good" && "border-emerald-500/30",
              ins.tone === "warn" && "border-amber-500/30"
            )}
          >
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                ins.tone === "good"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : ins.tone === "warn"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
              )}
            >
              <ins.icon className="h-3.5 w-3.5" />
              {ins.title}
            </div>
            <p className="mt-1.5 text-sm font-medium text-foreground">{ins.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Groups the journey into collapsible sections. */
function CourseJourney({
  videos,
  hasPeers,
  embedded: _embedded = false,
}: {
  videos: CourseVideoAnalyticsVideo[];
  hasPeers: boolean;
  embedded?: boolean;
}) {
  // Group videos by section, preserving course order; keep each video's global index.
  const sections = useMemo(() => {
    const groups: Array<{
      title: string;
      items: Array<{ video: CourseVideoAnalyticsVideo; globalIndex: number }>;
    }> = [];
    videos.forEach((video, globalIndex) => {
      const title = video.sectionTitle || "Course content";
      const last = groups[groups.length - 1];
      if (last && last.title === title) {
        last.items.push({ video, globalIndex });
      } else {
        groups.push({ title, items: [{ video, globalIndex }] });
      }
    });
    return groups;
  }, [videos]);

  // Default: expand the section holding the first not-completed video ("where you are").
  const defaultOpenTitle = useMemo(() => {
    const firstIncomplete = videos.find((v) => !v.yourCompleted);
    if (firstIncomplete) return firstIncomplete.sectionTitle || "Course content";
    return sections[0]?.title;
  }, [videos, sections]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  // Default: open only the section holding the first not-completed video.
  const isOpen = (title: string) => open[title] ?? title === defaultOpenTitle;

  // If there is effectively one section, render a flat timeline (no accordion noise).
  if (sections.length <= 1) {
    return (
      <div>
        {videos.map((v, i) => (
          <VideoStep
            key={v.lectureId}
            video={v}
            index={i}
            isLast={i === videos.length - 1}
            hasPeers={hasPeers}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const done = section.items.filter((it) => it.video.yourCompleted).length;
        const total = section.items.length;
        const expanded = isOpen(section.title);
        const allDone = done === total;
        return (
          <div key={section.title} className="overflow-hidden rounded-xl border bg-card">
            <button
              type="button"
              onClick={() =>
                setOpen((prev) => ({ ...prev, [section.title]: !expanded }))
              }
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    allDone
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {allDone ? <CheckCircle2 className="h-4 w-4" /> : done}
                </span>
                <span className="truncate text-sm font-semibold text-foreground">
                  {section.title}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {done}/{total}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    expanded && "rotate-180"
                  )}
                />
              </div>
            </button>
            {expanded && (
              <div className="border-t bg-muted/10 px-3 pb-3 pt-3">
                {section.items.map((it, idx) => (
                  <VideoStep
                    key={it.video.lectureId}
                    video={it.video}
                    index={it.globalIndex}
                    isLast={idx === section.items.length - 1}
                    hasPeers={hasPeers}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CourseVideoAnalyticsProps {
  /**
   * When provided, the component is locked to this single course: it skips the
   * member course list (no `useMemberAnalytics`), hides the course selector and
   * the header row, and renders only the analytics body for this course. Used
   * for the in-player "Your Progress" modal which already knows the course.
   */
  courseId?: string;
  /**
   * When true, the component is embedded inside chrome that already provides a
   * heading + card. Reduces top-level spacing and drops any extra outer
   * wrapper so we don't nest bordered cards inside bordered cards.
   */
  embedded?: boolean;
}

export default function CourseVideoAnalytics({
  courseId,
  embedded = false,
}: CourseVideoAnalyticsProps = {}) {
  // Locked-to-course mode skips the member course list entirely.
  const locked = !!courseId;
  const { data: memberData, isLoading: isMemberLoading } = useMemberAnalytics({
    enabled: !locked,
  });

  const courses = useMemo(
    () => memberData?.learningProgress.courseProgress ?? [],
    [memberData]
  );

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // In locked mode use the provided id; otherwise default to the first enrolled
  // course once the list is available.
  const activeCourseId = locked
    ? courseId!
    : selectedCourseId ?? courses[0]?.courseId ?? null;

  const { data, isLoading } = useCourseVideoAnalytics(activeCourseId);

  // Non-locked path keeps the original loading/empty states.
  if (!locked && isMemberLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!locked && courses.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed">
        <p className="text-sm text-muted-foreground">No enrolled courses to analyse yet</p>
      </div>
    );
  }

  const summary = data?.summary;
  const hasPeers = (summary?.peerCount ?? 0) > 0;

  // Grouped bar chart (You vs Average): ALL videos in course order. When the
  // course is long the chart becomes horizontally scrollable (each video gets a
  // fixed min width) so every video's comparison stays readable.
  const allVideos = data?.videos ?? [];
  const chartData = allVideos.map((v, i) => ({
    name: `${i + 1}. ${v.title.length > 14 ? `${v.title.slice(0, 14)}…` : v.title}`,
    You: v.yourSeconds,
    Average: v.avgSeconds,
  }));
  // Width per video group; the chart scrolls horizontally past ~10 videos.
  const PER_VIDEO_PX = 56;
  const chartWidth = Math.max(chartData.length * PER_VIDEO_PX, 480);

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {/* ── Course selector (course-wise) ─────────────────────────────── */}
      {/* Hidden when locked to a single course (e.g. embedded in the player). */}
      {!locked && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Course Video Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Time spent per video, compared with other learners
            </p>
          </div>
          <Select
            value={activeCourseId ?? undefined}
            onValueChange={(v) => setSelectedCourseId(v)}
          >
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Select a course" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.courseId} value={c.courseId}>
                  {c.courseTitle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading || !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ── Summary cards ───────────────────────────────────────── */}
          {summary && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                icon={Clock}
                label="Your Time"
                value={formatDuration(summary.yourTotalSeconds)}
                compare={
                  hasPeers ? (
                    <AvgDelta yours={summary.yourTotalSeconds} avg={summary.avgTotalSeconds} unit="time" />
                  ) : (
                    <span className="text-muted-foreground">Total watched</span>
                  )
                }
              />
              <SummaryCard
                icon={TrendingUp}
                label="Completion"
                value={`${Math.round(summary.yourProgressPercent)}%`}
                compare={
                  hasPeers ? (
                    <AvgDelta yours={summary.yourProgressPercent} avg={summary.avgProgressPercent} unit="percent" />
                  ) : (
                    <span className="text-muted-foreground">Of course</span>
                  )
                }
              />
              <SummaryCard
                icon={CheckCircle2}
                label="Videos Done"
                value={`${summary.yourCompletedVideos}/${summary.totalVideos}`}
                compare={<span className="text-muted-foreground">Videos completed</span>}
              />
              <SummaryCard
                icon={Users}
                label="Cohort"
                value={hasPeers ? `${summary.peerCount}` : "-"}
                compare={
                  <span className="text-muted-foreground">
                    {hasPeers ? `compared with ${summary.peerCount} learners` : "No peers yet"}
                  </span>
                }
              />
            </div>
          )}

          {!hasPeers && (
            <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Not enough learners yet for comparison, showing your times only.
            </div>
          )}

          {/* ── Auto-generated insights ─────────────────────────────── */}
          {summary && data.videos.length > 0 && (
            <InsightStrip
              videos={data.videos}
              yourTotal={summary.yourTotalSeconds}
              avgTotal={summary.avgTotalSeconds}
              hasPeers={hasPeers}
            />
          )}

          {/* ── Visual row: completion donut + comparison chart ─────── */}
          {summary && data.videos.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <CompletionDonut
                done={summary.yourCompletedVideos}
                total={summary.totalVideos}
              />
              <div className="lg:col-span-2 flex flex-col">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {hasPeers ? "You vs Average, per video" : "Time spent, per video"}
                  </p>
                  {hasPeers && (
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "hsl(var(--primary))" }} /> You
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/50" /> Average
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-x-auto rounded-xl border bg-card p-4 [scrollbar-width:thin]">
                  <div style={{ width: chartWidth, height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 6, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          angle={-35}
                          textAnchor="end"
                          height={70}
                          className="fill-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatShort}
                          width={40}
                          className="fill-muted-foreground"
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fillOpacity: 0.08 }} />
                        <Bar dataKey="You" radius={[3, 3, 0, 0]} fill="hsl(var(--primary))" />
                        {hasPeers && (
                          <Bar dataKey="Average" radius={[3, 3, 0, 0]} fill="hsl(var(--muted-foreground))" fillOpacity={0.5} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {chartData.length > 8 && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Scroll sideways to see all {chartData.length} videos →
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Course journey timeline (video-wise breakdown) ──────── */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your course journey
              </p>
              <p className="text-[11px] text-muted-foreground">{data.videos.length} videos</p>
            </div>
            {data.videos.length > 0 ? (
              <CourseJourney videos={data.videos} hasPeers={hasPeers} embedded={embedded} />
            ) : (
              <div className="flex h-[160px] items-center justify-center rounded-xl border border-dashed">
                <p className="text-sm text-muted-foreground">No videos in this course yet</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
