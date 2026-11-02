"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  useToast,
} from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import { BookOpen, Clock, Download, GraduationCap, Loader2, Video } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { membersApi } from "../../../lib/api/members";
import { useMemberCourseAnalytics } from "../../../lib/hooks/use-members";
import type { MemberCourseAnalyticsSummary } from "../../../lib/types/members";
import {
  formatDurationShort,
  formatLastWatched,
} from "../course-analytics-format";
import { CourseAnalyticsDetailDialog } from "../CourseAnalyticsDetailDialog";
import {
  AssignmentAnalyticsSection,
  QuizAnalyticsSection,
} from "./QuizAssignmentAnalytics";

interface CourseAnalyticsTabProps {
  memberId: string;
  enabled: boolean;
}

const COMPLETED_COLOR = "hsl(var(--primary))";
const IN_PROGRESS_COLOR = "#60a5fa";
const NOT_STARTED_COLOR = "hsl(var(--muted))";

export function CourseAnalyticsTab({ memberId, enabled }: CourseAnalyticsTabProps) {
  const { toast } = useToast();
  const { data: summaries, isLoading } = useMemberCourseAnalytics(
    memberId,
    enabled
  );

  const [exporting, setExporting] = useState(false);
  const [openCourse, setOpenCourse] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const totals = useMemo(() => {
    if (!summaries || summaries.length === 0) {
      return {
        totalCourses: 0,
        totalLectures: 0,
        completedLectures: 0,
        watchedSeconds: 0,
        totalDurationSeconds: 0,
        totalWatchSeconds: 0,
        overallCompletion: 0,
      };
    }
    const totalLectures = summaries.reduce((a, c) => a + c.total_lectures, 0);
    const completedLectures = summaries.reduce(
      (a, c) => a + c.completed_lectures,
      0
    );
    return {
      totalCourses: summaries.length,
      totalLectures,
      completedLectures,
      watchedSeconds: summaries.reduce((a, c) => a + c.watched_seconds, 0),
      totalDurationSeconds: summaries.reduce(
        (a, c) => a + c.total_duration_seconds,
        0
      ),
      totalWatchSeconds: summaries.reduce(
        (a, c) => a + c.total_watch_seconds,
        0
      ),
      overallCompletion:
        totalLectures > 0
          ? Math.round((completedLectures / totalLectures) * 100)
          : 0,
    };
  }, [summaries]);

  const handleExport = useCallback(async () => {
    if (!summaries || summaries.length === 0) return;
    setExporting(true);
    try {
      await membersApi.downloadMemberCourseAnalyticsXlsx(memberId);
      toast({
        title: "Export ready",
        description:
          "Workbook downloaded with profile, course, section, lecture, quiz, assignment, and 90-day activity sheets.",
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Could not export",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }, [memberId, summaries, toast]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" /> Course Video Analytics
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Per-course completion and watch time for this learner. Click any
                card for the lecture-by-lecture breakdown.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleExport}
                disabled={
                  exporting || isLoading || !summaries || summaries.length === 0
                }
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Export Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <SummaryStat
              label="Courses"
              value={String(totals.totalCourses)}
              icon={GraduationCap}
            />
            <SummaryStat
              label="Videos watched"
              value={`${totals.completedLectures} / ${totals.totalLectures}`}
              sub={`${totals.overallCompletion}% complete`}
              icon={BookOpen}
            />
            <SummaryStat
              label="Watched"
              value={formatDurationShort(totals.watchedSeconds)}
              sub={
                totals.totalDurationSeconds > 0
                  ? `of ${formatDurationShort(totals.totalDurationSeconds)}`
                  : "total duration unknown"
              }
              icon={Clock}
            />
            <SummaryStat
              label="Time spent"
              value={formatDurationShort(totals.totalWatchSeconds)}
              sub="includes rewatches"
              icon={Clock}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-[220px]">
              <CardContent className="p-4">
                <div className="h-full bg-muted/40 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !summaries || summaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Video className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No course enrollments yet. Grant access from the Learning tab to
              start tracking analytics.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((course) => (
            <CourseAnalyticsCard
              key={course.course_id}
              course={course}
              onOpen={() =>
                setOpenCourse({
                  id: course.course_id,
                  title: course.course_title,
                })
              }
            />
          ))}
        </div>
      )}

      <QuizAnalyticsSection memberId={memberId} enabled={enabled} />
      <AssignmentAnalyticsSection memberId={memberId} enabled={enabled} />

      <CourseAnalyticsDetailDialog
        memberId={memberId}
        courseId={openCourse?.id ?? null}
        courseTitle={openCourse?.title ?? ""}
        open={!!openCourse}
        onOpenChange={(o) => {
          if (!o) setOpenCourse(null);
        }}
      />
    </div>
  );
}

function CourseAnalyticsCard({
  course,
  onOpen,
}: {
  course: MemberCourseAnalyticsSummary;
  onOpen: () => void;
}) {
  const inProgress = Math.max(
    0,
    course.touched_lectures - course.completed_lectures
  );
  const donutData =
    course.total_lectures > 0
      ? [
          { name: "Completed", value: course.completed_lectures },
          { name: "In Progress", value: inProgress },
          { name: "Not Started", value: course.not_started_lectures },
        ].filter((d) => d.value > 0)
      : [{ name: "No videos", value: 1 }];

  const colors =
    course.total_lectures > 0
      ? [
          ...(course.completed_lectures > 0 ? [COMPLETED_COLOR] : []),
          ...(inProgress > 0 ? [IN_PROGRESS_COLOR] : []),
          ...(course.not_started_lectures > 0 ? [NOT_STARTED_COLOR] : []),
        ]
      : [NOT_STARTED_COLOR];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left rounded-lg border bg-card hover:bg-muted/30 transition-colors overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <div className="p-4 flex items-start gap-3">
        <div className="relative w-[72px] h-[72px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                innerRadius={22}
                outerRadius={32}
                paddingAngle={donutData.length > 1 ? 2 : 0}
                stroke="none"
              >
                {donutData.map((_, i) => (
                  <Cell key={i} fill={colors[i] ?? NOT_STARTED_COLOR} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm font-semibold tabular-nums">
              {course.completion_percent}%
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm leading-tight line-clamp-2">
            {decodeHtmlEntities(course.course_title)}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] py-0 h-4">
              {course.course_mode.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className="text-[10px] py-0 h-4">
              {course.enrollment_source}
            </Badge>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Videos watched</span>
          <span className="font-medium tabular-nums">
            {course.completed_lectures}
            <span className="text-muted-foreground">
              {" / "}
              {course.total_lectures}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Watched</span>
          <span className="font-medium tabular-nums">
            {formatDurationShort(course.watched_seconds)}
            {course.total_duration_seconds > 0 ? (
              <span className="text-muted-foreground">
                {" / "}
                {formatDurationShort(course.total_duration_seconds)}
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Last active</span>
          <span className="font-medium tabular-nums">
            {formatLastWatched(course.last_activity_at)}
          </span>
        </div>
      </div>
    </button>
  );
}

function SummaryStat({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof GraduationCap;
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-lg font-semibold tabular-nums leading-tight mt-0.5">
        {value}
      </p>
      {sub ? (
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
      ) : null}
    </div>
  );
}
