"use client";

import { Badge, Card, CardContent } from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import {
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  Percent,
  Target,
} from "lucide-react";
import { useMemo } from "react";

import {
  useMemberAssignmentAnalytics,
  useMemberQuizAnalytics,
} from "../../../lib/hooks/use-members";
import type {
  MemberAssignmentAnalyticsItem,
  MemberQuizAnalyticsItem,
} from "../../../lib/types/members";
import { formatLastWatched } from "../course-analytics-format";

interface Props {
  memberId: string;
  enabled: boolean;
}

// ────────────────────────────────────────────────────────────────────
// Shared bits
// ────────────────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof GraduationCap;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <Icon className="h-4 w-4" /> {title}
      </h3>
      <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

function Stat({
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
    <div className="rounded-md bg-muted/40 px-3 py-2">
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

type PillTone = "success" | "danger" | "warn" | "info" | "muted";

const PILL_CLASSES: Record<PillTone, string> = {
  success:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent",
  danger: "bg-red-500/15 text-red-700 dark:text-red-300 border-transparent",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent",
  info: "bg-primary/15 text-primary border-transparent",
  muted: "bg-muted text-muted-foreground border-transparent",
};

function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
  return (
    <Badge className={`text-[10px] py-0 h-5 ${PILL_CLASSES[tone]}`}>
      {label}
    </Badge>
  );
}

function RowSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-11 rounded-md bg-muted/40 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: typeof GraduationCap;
  message: string;
}) {
  return (
    <div className="py-10 text-center">
      <Icon className="h-9 w-9 mx-auto text-muted-foreground mb-2.5" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Quiz status mapping
// ────────────────────────────────────────────────────────────────────
function quizStatusPill(status: string): { tone: PillTone; label: string } {
  switch (status) {
    case "PASSED":
      return { tone: "success", label: "Passed" };
    case "FAILED":
      return { tone: "danger", label: "Failed" };
    case "IN_PROGRESS":
      return { tone: "warn", label: "In progress" };
    default:
      return { tone: "muted", label: "Not attempted" };
  }
}

function assignmentStatusPill(status: string): {
  tone: PillTone;
  label: string;
} {
  switch (status) {
    case "EVALUATED":
      return { tone: "success", label: "Evaluated" };
    case "UNDER_REVIEW":
      return { tone: "info", label: "Under review" };
    case "RESUBMISSION_REQUESTED":
      return { tone: "danger", label: "Resubmission" };
    case "SUBMITTED":
      return { tone: "warn", label: "Submitted" };
    case "PENDING":
      return { tone: "warn", label: "Pending" };
    default:
      return { tone: "muted", label: "Not submitted" };
  }
}

// ────────────────────────────────────────────────────────────────────
// Quiz section
// ────────────────────────────────────────────────────────────────────
function QuizRow({ quiz }: { quiz: MemberQuizAnalyticsItem }) {
  const pill = quizStatusPill(quiz.status);
  const attempted = quiz.attempt_count > 0;
  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/40 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight truncate">
          {decodeHtmlEntities(quiz.quiz_title)}
        </p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {decodeHtmlEntities(quiz.course_title)}
        </p>
      </div>
      <div className="hidden sm:block text-right w-24 shrink-0">
        <p className="text-sm font-semibold tabular-nums">
          {attempted ? `${quiz.best_percentage}%` : "-"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {attempted
            ? `${quiz.best_score}/${
                quiz.best_total_marks || quiz.max_score
              }`
            : "no attempts"}
        </p>
      </div>
      <div className="hidden md:block text-right w-16 shrink-0">
        <p className="text-sm tabular-nums">{quiz.attempt_count}</p>
        <p className="text-[11px] text-muted-foreground">
          {quiz.attempt_count === 1 ? "attempt" : "attempts"}
        </p>
      </div>
      <div className="hidden lg:block text-right w-20 shrink-0">
        <p className="text-[11px] text-muted-foreground">
          {formatLastWatched(quiz.last_attempt_at)}
        </p>
      </div>
      <div className="w-24 shrink-0 flex justify-end">
        <StatusPill tone={pill.tone} label={pill.label} />
      </div>
    </div>
  );
}

export function QuizAnalyticsSection({ memberId, enabled }: Props) {
  const { data, isLoading } = useMemberQuizAnalytics(memberId, enabled);
  const summary = data?.summary;
  const quizzes = data?.quizzes ?? [];

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-4">
        <SectionHeader
          icon={GraduationCap}
          title="Quiz Analytics"
          subtitle="Per-quiz results across this learner's enrolled courses, best attempt shown."
        />

        {isLoading ? (
          <RowSkeleton />
        ) : quizzes.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            message="No quizzes in this learner's enrolled courses yet."
          />
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Stat
                label="Quizzes"
                value={String(summary?.total_quizzes ?? 0)}
                sub={`${summary?.attempted ?? 0} attempted`}
                icon={ClipboardList}
              />
              <Stat
                label="Passed"
                value={String(summary?.passed ?? 0)}
                sub={`of ${summary?.total_quizzes ?? 0}`}
                icon={Target}
              />
              <Stat
                label="Avg. best score"
                value={
                  summary?.average_best_percent != null
                    ? `${summary.average_best_percent}%`
                    : "-"
                }
                sub="attempted quizzes"
                icon={Percent}
              />
              <Stat
                label="Attempted"
                value={`${summary?.attempted ?? 0} / ${
                  summary?.total_quizzes ?? 0
                }`}
                sub={
                  summary && summary.total_quizzes > 0
                    ? `${Math.round(
                        (summary.attempted / summary.total_quizzes) * 100
                      )}% coverage`
                    : undefined
                }
                icon={ClipboardCheck}
              />
            </div>

            <div className="space-y-0.5">
              {quizzes.map((q) => (
                <QuizRow key={q.quiz_id} quiz={q} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
// Assignment section
// ────────────────────────────────────────────────────────────────────
function AssignmentRow({
  assignment,
}: {
  assignment: MemberAssignmentAnalyticsItem;
}) {
  const pill = assignmentStatusPill(assignment.submission_status);
  const scored = assignment.is_evaluated && assignment.score != null;
  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/40 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight truncate">
          {decodeHtmlEntities(assignment.assignment_title)}
        </p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {decodeHtmlEntities(assignment.course_title)}
          {assignment.is_late != null ? (
            <span
              className={
                assignment.is_late
                  ? "text-red-600 dark:text-red-400 ml-1.5"
                  : "text-emerald-600 dark:text-emerald-400 ml-1.5"
              }
            >
              · {assignment.is_late ? "Late" : "On time"}
            </span>
          ) : null}
        </p>
      </div>
      <div className="hidden sm:block text-right w-24 shrink-0">
        <p className="text-sm font-semibold tabular-nums">
          {scored
            ? assignment.score_percentage != null
              ? `${assignment.score_percentage}%`
              : `${assignment.score}`
            : "-"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {scored
            ? `${assignment.score}/${assignment.max_score}`
            : assignment.is_evaluated
              ? "evaluated"
              : "not graded"}
        </p>
      </div>
      <div className="hidden lg:block text-right w-20 shrink-0">
        <p className="text-[11px] text-muted-foreground">
          {assignment.submitted_at
            ? formatLastWatched(assignment.submitted_at)
            : "-"}
        </p>
        <p className="text-[10px] text-muted-foreground">submitted</p>
      </div>
      <div className="w-28 shrink-0 flex justify-end">
        <StatusPill tone={pill.tone} label={pill.label} />
      </div>
    </div>
  );
}

export function AssignmentAnalyticsSection({ memberId, enabled }: Props) {
  const { data, isLoading } = useMemberAssignmentAnalytics(memberId, enabled);
  const summary = data?.summary;
  const assignments = useMemo(() => data?.assignments ?? [], [data]);

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-4">
        <SectionHeader
          icon={FileText}
          title="Assignment Analytics"
          subtitle="Submission status and grades across this learner's enrolled courses."
        />

        {isLoading ? (
          <RowSkeleton />
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={FileText}
            message="No assignments in this learner's enrolled courses yet."
          />
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Stat
                label="Assignments"
                value={String(summary?.total_assignments ?? 0)}
                sub={`${summary?.submitted ?? 0} submitted`}
                icon={ClipboardList}
              />
              <Stat
                label="Submitted"
                value={`${summary?.submitted ?? 0} / ${
                  summary?.total_assignments ?? 0
                }`}
                sub={
                  summary && summary.total_assignments > 0
                    ? `${Math.round(
                        (summary.submitted / summary.total_assignments) * 100
                      )}% coverage`
                    : undefined
                }
                icon={ClipboardCheck}
              />
              <Stat
                label="Evaluated"
                value={String(summary?.evaluated ?? 0)}
                sub={`of ${summary?.submitted ?? 0} submitted`}
                icon={Target}
              />
              <Stat
                label="Avg. score"
                value={
                  summary?.average_score_percent != null
                    ? `${summary.average_score_percent}%`
                    : "-"
                }
                sub="evaluated assignments"
                icon={Percent}
              />
            </div>

            <div className="space-y-0.5">
              {assignments.map((a) => (
                <AssignmentRow key={a.assignment_id} assignment={a} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
