"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  useToast,
} from "@open-mtlms/core";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Gauge,
  Lightbulb,
  Loader2,
  Percent,
  Search,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { Fragment, useState } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_COLORS } from "@/components/analytics/chart-utils";
import { FunnelChart } from "@/components/analytics/funnel-chart";
import { TrendStat } from "@/components/analytics/trend-stat";
import { testsApi } from "@/lib/api/test-series";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};
const tooltipLabel = { color: "hsl(var(--foreground))" };

const accColor = (pct: number): string =>
  pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";

function fmtDuration(sec: number | null): string {
  if (sec == null || sec <= 0) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${sec % 60}s`;
}

/** Ranked accuracy rows shown as clean progress bars (no bar chart). */
function AccuracyList({
  rows,
}: {
  rows: Array<{ label: string; pct: number; sub?: string }>;
}) {
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm" title={r.label}>
            {r.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(2, r.pct)}%`,
                backgroundColor: accColor(r.pct),
              }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums">
            {r.pct}%{r.sub ? ` · ${r.sub}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TestAnalyticsCard({
  testId,
  seriesId,
}: {
  testId?: string;
  seriesId?: string;
}) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [learnerSearch, setLearnerSearch] = useState("");
  const [expandedLearner, setExpandedLearner] = useState<string | null>(null);
  const isSeries = !!seriesId;
  const id = seriesId ?? testId ?? "";
  const { data, isLoading } = useQuery({
    queryKey: [isSeries ? "series-analytics" : "test-analytics", id],
    queryFn: () =>
      isSeries ? testsApi.getSeriesAnalytics(id) : testsApi.getAnalytics(id),
    enabled: !!id,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = isSeries
        ? await testsApi.exportSeriesAnalytics(id)
        : await testsApi.exportAnalytics(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isSeries ? "series" : "test"}-analytics-${id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">Analytics</h2>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={exporting || isLoading}
      >
        {exporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Export Excel
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!data || data.kpis.submitted === 0) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No submitted attempts yet, analytics will appear once learners
            complete {isSeries ? "a test in this series" : "this test"}.
          </CardContent>
        </Card>
      </div>
    );
  }

  const k = data.kpis;
  const distData = data.scoreDistribution.map((b) => ({
    name: b.bucket,
    count: b.count,
  }));
  const percentileData = data.percentileBands.map((p) => ({
    name: p.band,
    count: p.count,
  }));
  const difficultyShare = data.difficulty
    .filter((d) => d.answered > 0)
    .map((d) => ({ name: d.difficulty, value: d.answered }));

  // Learners: best attempt per user already deduped server-side.
  const q = learnerSearch.trim().toLowerCase();
  const submittedSorted = [...data.learners]
    .filter((l) => l.status === "SUBMITTED")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const visibleLearners = q
    ? data.learners.filter(
        (l) =>
          l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q)
      )
    : submittedSorted.slice(0, 10);

  return (
    <div className="space-y-4">
      {header}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <TrendStat title="Submitted" value={k.submitted} icon={Users} accentColor="bg-blue-500" size="mini" />
        <TrendStat title="Avg %" value={k.avgPercentage} format="percent" icon={Target} accentColor="bg-emerald-500" size="mini" />
        <TrendStat title="Pass rate" value={k.passRate} format="percent" icon={CheckCircle2} accentColor="bg-teal-500" size="mini" />
        <TrendStat title="Median score" value={k.medianScore} icon={Gauge} accentColor="bg-violet-500" size="mini" />
        <TrendStat title="Avg percentile" value={k.avgPercentile} icon={Percent} accentColor="bg-amber-500" size="mini" />
        <TrendStat title="Avg time" value={k.avgDurationSec} format="duration" icon={Clock} accentColor="bg-cyan-500" size="mini" />
      </div>

      {/* Completion funnel */}
      <FunnelChart
        title="Completion funnel"
        description="From starting the test to passing it"
        stages={[
          { label: "Started", value: data.funnel.started, color: "bg-cyan-500" },
          { label: "Submitted", value: data.funnel.submitted, color: "bg-blue-500" },
          { label: "Passed", value: data.funnel.passed, color: "bg-emerald-500" },
        ]}
      />

      {/* Distributions (gradient area) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score distribution</CardTitle>
            <CardDescription className="text-xs">Learners per score % band</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={distData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[1]} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipLabel} />
                <Area type="monotone" dataKey="count" name="Learners" stroke={CHART_COLORS[1]} fill="url(#scoreGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Percentile distribution</CardTitle>
            <CardDescription className="text-xs">Learners per percentile band</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={percentileData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="pctGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[4]} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_COLORS[4]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipLabel} />
                <Area type="monotone" dataKey="count" name="Learners" stroke={CHART_COLORS[4]} fill="url(#pctGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

      {/* Difficulty share (donut) + topic accuracy */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Answers by difficulty</CardTitle>
            <CardDescription className="text-xs">Share of answered questions</CardDescription>
          </CardHeader>
          <CardContent>
            {difficultyShare.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart margin={{ top: 20, right: 20, bottom: 4, left: 20 }}>
                  <Pie
                    data={difficultyShare}
                    cx="50%" cy="50%"
                    innerRadius={48} outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${String(name ?? "")} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {difficultyShare.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipLabel} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Accuracy by topic</CardTitle>
            <CardDescription className="text-xs">Weakest first, focus areas for revision</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topics.length > 0 ? (
              <AccuracyList
                rows={data.topics
                  .slice(0, 10)
                  .map((t) => ({ label: t.topic, pct: t.accuracyPct }))}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No topic data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Difficulty & type accuracy + insights */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Accuracy by difficulty &amp; type</CardTitle>
            <CardDescription className="text-xs">Where learners struggle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.difficulty.length > 0 && (
              <AccuracyList
                rows={data.difficulty.map((d) => ({
                  label: d.difficulty,
                  pct: d.accuracyPct,
                }))}
              />
            )}
            {data.typeBreakdown.length > 0 && (
              <AccuracyList
                rows={data.typeBreakdown.map((t) => ({
                  label: t.type,
                  pct: t.accuracyPct,
                }))}
              />
            )}
          </CardContent>
        </Card>

        {/* Insights */}
        {data.insights.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4 text-amber-500" /> Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {data.insights.map((line, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    • {line}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Learners, top performers + search (best attempt per user) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-amber-500" />
              {q ? `Search results (${visibleLearners.length})` : "Top performers"}
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={learnerSearch}
                onChange={(e) => setLearnerSearch(e.target.value)}
                placeholder="Search learner by name or email…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>
          <CardDescription className="text-xs">
            One row per learner, their best attempt.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-4 py-2 font-medium">Learner</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Score</th>
                  <th className="px-4 py-2 font-medium">%</th>
                  <th className="px-4 py-2 font-medium">Percentile</th>
                  <th className="px-4 py-2 font-medium">Attempts</th>
                  <th className="px-4 py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {visibleLearners.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                      No learners match &quot;{learnerSearch}&quot;.
                    </td>
                  </tr>
                ) : (
                  visibleLearners.map((l, i) => {
                    const expanded = expandedLearner === l.learnerId;
                    const multi = l.attempts > 1;
                    return (
                      <Fragment key={`${l.learnerId}-${i}`}>
                        <tr className="border-t">
                          <td className="px-4 py-2 text-muted-foreground">{l.rank ?? (q ? "-" : i + 1)}</td>
                          <td className="px-4 py-2 font-medium">{l.name}</td>
                          <td className="px-4 py-2 text-muted-foreground">{l.email}</td>
                          <td className="px-4 py-2">{l.score ?? "-"}</td>
                          <td className="px-4 py-2">{l.percentage != null ? `${l.percentage}%` : "-"}</td>
                          <td className="px-4 py-2">{l.percentile ?? "-"}</td>
                          <td className="px-4 py-2">
                            {multi ? (
                              <button
                                onClick={() =>
                                  setExpandedLearner(expanded ? null : l.learnerId)
                                }
                                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                                title="Show every attempt by this learner"
                              >
                                {expanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                                {l.attempts}
                              </button>
                            ) : (
                              l.attempts
                            )}
                          </td>
                          <td className="px-4 py-2">{fmtDuration(l.durationSec)}</td>
                        </tr>
                        {expanded && (
                          <tr className="bg-muted/20">
                            <td colSpan={8} className="px-4 py-3">
                              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                                All attempts (oldest → newest), best is highlighted
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead className="text-muted-foreground">
                                    <tr className="text-left">
                                      <th className="py-1 pr-4 font-medium">Attempt</th>
                                      <th className="py-1 pr-4 font-medium">Status</th>
                                      <th className="py-1 pr-4 font-medium">Score</th>
                                      <th className="py-1 pr-4 font-medium">%</th>
                                      <th className="py-1 pr-4 font-medium">Percentile</th>
                                      <th className="py-1 pr-4 font-medium">Time</th>
                                      <th className="py-1 pr-4 font-medium">Date</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(l.attemptHistory ?? []).map((h, hi) => {
                                      const isBest =
                                        h.status === "SUBMITTED" &&
                                        h.score != null &&
                                        l.score != null &&
                                        h.score === l.score;
                                      return (
                                        <tr
                                          key={hi}
                                          className={
                                            isBest ? "font-medium text-emerald-600" : ""
                                          }
                                        >
                                          <td className="py-1 pr-4">#{hi + 1}</td>
                                          <td className="py-1 pr-4">{h.status.replace(/_/g, " ")}</td>
                                          <td className="py-1 pr-4">{h.score ?? "-"}</td>
                                          <td className="py-1 pr-4">{h.percentage != null ? `${h.percentage}%` : "-"}</td>
                                          <td className="py-1 pr-4">{h.percentile ?? "-"}</td>
                                          <td className="py-1 pr-4">{fmtDuration(h.durationSec)}</td>
                                          <td className="py-1 pr-4">
                                            {h.submittedAt
                                              ? new Date(h.submittedAt).toLocaleDateString()
                                              : "-"}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Questions by accuracy */}
      {data.questions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Questions by accuracy</CardTitle>
            <CardDescription className="text-xs">Lowest accuracy first</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Question</th>
                    <th className="px-4 py-2 font-medium">Difficulty</th>
                    <th className="px-4 py-2 font-medium">Answered</th>
                    <th className="px-4 py-2 font-medium">Accuracy</th>
                    <th className="px-4 py-2 font-medium">Avg time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.questions.slice(0, 15).map((qq) => (
                    <tr key={qq.questionId} className="border-t">
                      <td className="max-w-md truncate px-4 py-2">{qq.stem}</td>
                      <td className="px-4 py-2">{qq.difficulty}</td>
                      <td className="px-4 py-2">{qq.answered}</td>
                      <td className="px-4 py-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                          style={{ backgroundColor: accColor(qq.accuracyPct) }}
                        >
                          {qq.accuracyPct}%
                        </span>
                      </td>
                      <td className="px-4 py-2">{fmtDuration(qq.avgTimeSec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TestAnalyticsCard;
