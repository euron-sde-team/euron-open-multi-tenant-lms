"use client";

import {
  BookOpen,
  Brain,
  CheckCircle,
  Clock,
  Flame,
  GraduationCap,
  Loader2,
  Monitor,
  Star,
  Target,
  CreditCard,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import { useMemberAnalytics } from "@/lib/hooks/use-member-analytics";
import type { MemberAnalyticsData } from "@/lib/api/member-analytics";

// ─── Colors ──────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  subtitle,
}: {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconColor)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
          {subtitle && <p className="text-[11px] text-zinc-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/50">
      <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{value}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">{children}</h3>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
      <p className="text-sm text-zinc-400">{message}</p>
    </div>
  );
}

function ChartContainer({ children, height = 250 }: { children: React.ReactNode; height?: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="font-bold text-zinc-900 dark:text-zinc-100">{payload[0].value}</p>
    </div>
  );
};

function ActivityHeatmap({ data }: { data: Array<{ day: string; minutes: number }> }) {
  // Build a map of day → minutes for quick lookup
  const dayMap = new Map<string, number>();
  for (const d of data) dayMap.set(d.day, d.minutes);

  // Generate 365 days ending today
  const today = new Date();
  const days: Array<{ date: string; minutes: number; dayOfWeek: number }> = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    days.push({ date: key, minutes: dayMap.get(key) ?? 0, dayOfWeek: d.getDay() });
  }

  // Group by week (columns)
  const weeks: typeof days[] = [];
  let currentWeek: typeof days = [];
  for (const d of days) {
    if (d.dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(d);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const maxMinutes = Math.max(1, ...data.map((d) => d.minutes));

  const getColor = (mins: number) => {
    if (mins === 0) return "bg-zinc-100 dark:bg-zinc-800";
    const ratio = mins / maxMinutes;
    if (ratio < 0.25) return "bg-emerald-200 dark:bg-emerald-900";
    if (ratio < 0.5) return "bg-emerald-400 dark:bg-emerald-700";
    if (ratio < 0.75) return "bg-emerald-500 dark:bg-emerald-600";
    return "bg-emerald-600 dark:bg-emerald-500";
  };


  return (
    <div>
      <SectionTitle>Activity</SectionTitle>
      <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <div className="flex gap-[3px]" style={{ minWidth: "720px" }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((d) => (
                  <div
                    key={d.date}
                    className={cn("h-[13px] w-[13px] rounded-[2px] transition-colors", getColor(d.minutes))}
                    title={`${d.date}: ${d.minutes} min`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400">
          <span>
            {data.length > 0 ? `${data.reduce((s, d) => s + d.minutes, 0)} min total activity this year` : "No activity yet"}
          </span>
          <div className="flex items-center gap-1">
            <span>Less</span>
            <div className="h-[10px] w-[10px] rounded-[2px] bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-[10px] w-[10px] rounded-[2px] bg-emerald-200 dark:bg-emerald-900" />
            <div className="h-[10px] w-[10px] rounded-[2px] bg-emerald-400 dark:bg-emerald-700" />
            <div className="h-[10px] w-[10px] rounded-[2px] bg-emerald-500 dark:bg-emerald-600" />
            <div className="h-[10px] w-[10px] rounded-[2px] bg-emerald-600 dark:bg-emerald-500" />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatWeek(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function parseDevice(info: string | null): string {
  if (!info) return "Unknown device";
  if (info.includes("Chrome")) return "Chrome Browser";
  if (info.includes("Firefox")) return "Firefox Browser";
  if (info.includes("Safari") && !info.includes("Chrome")) return "Safari Browser";
  if (info.includes("curl")) return "API / cURL";
  if (info.includes("Mobile")) return "Mobile Browser";
  return info.length > 40 ? info.slice(0, 40) + "..." : info;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LearnerAnalytics() {
  const { data, isLoading } = useMemberAnalytics();

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const d = data as MemberAnalyticsData;

  return (
    <div className="space-y-8">
      {/* ── Section 1: Overview Stats ────────────────────────────────── */}
      <div>
        <SectionTitle>Overview</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard icon={GraduationCap} iconColor="bg-blue-500" label="Enrolled" value={d.overview.totalCoursesEnrolled} />
          <StatCard icon={CheckCircle} iconColor="bg-emerald-500" label="Completed" value={d.overview.coursesCompleted} subtitle={`${d.overview.completionRate}% rate`} />
          <StatCard icon={Clock} iconColor="bg-purple-500" label="Learning Hours" value={d.overview.totalLearningHours} />
          <StatCard icon={Flame} iconColor="bg-orange-500" label="Streak" value={`${d.overview.currentStreak}d`} />
          <StatCard icon={Brain} iconColor="bg-pink-500" label="Quizzes" value={d.overview.totalQuizAttempts} />
          <StatCard icon={Target} iconColor="bg-cyan-500" label="Avg Score" value={`${d.overview.averageQuizScore}%`} />
        </div>
      </div>

      {/* ── Activity Heatmap ────────────────────────────────────────── */}
      <ActivityHeatmap data={d.dailyActivity ?? []} />

      {/* ── Section 2: Learning Progress ─────────────────────────────── */}
      <div>
        <SectionTitle>Learning Progress</SectionTitle>

        {/* Course progress bars */}
        {d.learningProgress.courseProgress.length > 0 ? (
          <div className="mt-3 space-y-2">
            {d.learningProgress.courseProgress.map((c) => (
              <div key={c.courseId} className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{c.courseTitle}</p>
                  <span className="ml-2 shrink-0 text-xs font-semibold text-zinc-500">{c.progressPercent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      c.progressPercent >= 100 ? "bg-emerald-500" : c.progressPercent >= 50 ? "bg-blue-500" : "bg-amber-500"
                    )}
                    style={{ width: `${Math.min(c.progressPercent, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-zinc-400">
                  {c.completedLectures} / {c.totalLectures} lectures
                  {c.status === "COMPLETED" && ": Completed"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3"><EmptyState message="No courses enrolled yet" /></div>
        )}

        {/* Charts row */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* Weekly activity */}
          <div className="lg:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Weekly Activity (Last 12 Weeks)</p>
            {d.learningProgress.weeklyActivity.length > 0 ? (
              <ChartContainer height={220}>
                <AreaChart data={d.learningProgress.weeklyActivity} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="weeklyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" vertical={false} />
                  <XAxis dataKey="week" tickFormatter={formatWeek} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className="fill-zinc-400" />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className="fill-zinc-400" unit="h" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#weeklyGrad)" />
                </AreaChart>
              </ChartContainer>
            ) : (
              <EmptyState message="No activity data yet" />
            )}
          </div>

          {/* Time by course pie */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Time by Course</p>
            {d.learningProgress.timeByCourse.length > 0 ? (
              <ChartContainer height={220}>
                <PieChart>
                  <Pie data={d.learningProgress.timeByCourse} dataKey="hours" nameKey="courseTitle" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={2}>
                    {d.learningProgress.timeByCourse.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ChartContainer>
            ) : (
              <EmptyState message="No time data yet" />
            )}
          </div>
        </div>
      </div>

      {/* ── Section 3: Assessments ───────────────────────────────────── */}
      <div>
        <SectionTitle>Assessments</SectionTitle>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {/* Quiz scores chart */}
          <div className="lg:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Quiz Scores Over Time</p>
            {d.assessments.quizScores.length > 0 ? (
              <ChartContainer height={220}>
                <AreaChart data={d.assessments.quizScores} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="quizGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" vertical={false} />
                  <XAxis dataKey="completedAt" tickFormatter={formatDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className="fill-zinc-400" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className="fill-zinc-400" unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="percent" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#quizGrad)" dot={{ r: 3, fill: "#10b981" }} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <EmptyState message="No quiz attempts yet" />
            )}
          </div>

          {/* Assignment stats */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Assignments</p>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                {d.assessments.assignmentStats.completed}
                <span className="text-lg text-zinc-400"> / {d.assessments.assignmentStats.total}</span>
              </p>
              <p className="text-xs text-zinc-500">completed</p>
              {d.assessments.assignmentStats.total > 0 && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${(d.assessments.assignmentStats.completed / d.assessments.assignmentStats.total) * 100}%` }}
                  />
                </div>
              )}
              {d.assessments.assignmentStats.pending > 0 && (
                <p className="mt-2 text-xs text-amber-600">{d.assessments.assignmentStats.pending} pending</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: Content Engagement ─────────────────────────────── */}
      <div>
        <SectionTitle>Content Engagement</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <MiniStat icon={Star} label="Reviews Given" value={d.contentEngagement.reviews.count} />
          <MiniStat icon={BookOpen} label="Bookmarks" value={d.contentEngagement.bookmarks.courses + d.contentEngagement.bookmarks.books + d.contentEngagement.bookmarks.bundles} />
        </div>
      </div>

      {/* ── Section 6: Sessions & Login History ───────────────────────── */}
      <div>
        <SectionTitle>Sessions & Login History</SectionTitle>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {/* Login frequency chart */}
          <div className="lg:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Logins (Last 30 Days)</p>
            {d.sessions.loginFrequency.length > 0 ? (
              <ChartContainer height={200}>
                <AreaChart data={d.sessions.loginFrequency} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="loginGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={formatDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className="fill-zinc-400" />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className="fill-zinc-400" allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#loginGrad)" />
                </AreaChart>
              </ChartContainer>
            ) : (
              <EmptyState message="No login data" />
            )}
          </div>

          {/* Recent sessions table */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Recent Sessions</p>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                {d.sessions.activeSessions} active
              </span>
            </div>
            <div className="space-y-1.5">
              {d.sessions.recentSessions.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <Monitor className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">{parseDevice(s.deviceInfo)}</p>
                    <p className="text-[10px] text-zinc-400">{formatDate(s.createdAt)}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                      s.isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    )}
                  >
                    {s.isActive ? "Active" : "Expired"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 7: Financial Summary ──────────────────────────────── */}
      <div>
        <SectionTitle>Financial Summary</SectionTitle>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <CreditCard className="mb-2 h-5 w-5 text-blue-500" />
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {d.financial.currency === "USD" ? "$" : "\u20B9"}
              {d.financial.totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-zinc-500">Total spent on courses</p>
          </div>
        </div>
        {d.financial.purchaseBreakdown.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Purchases by Type</p>
            <ChartContainer height={220}>
              <PieChart>
                <Pie data={d.financial.purchaseBreakdown} dataKey="amount" nameKey="orderType" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={2} label={({ name }) => name}>
                  {d.financial.purchaseBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ChartContainer>
          </div>
        )}
      </div>
    </div>
  );
}
