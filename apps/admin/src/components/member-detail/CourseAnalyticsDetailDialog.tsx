"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import { CheckCircle2, Circle, Clock, PlayCircle } from "lucide-react";

import { useMemberCourseAnalyticsDetail } from "../../lib/hooks/use-members";

import { formatDurationShort, formatLastWatched } from "./course-analytics-format";

interface CourseAnalyticsDetailDialogProps {
  memberId: string;
  courseId: string | null;
  courseTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CourseAnalyticsDetailDialog({
  memberId,
  courseId,
  courseTitle,
  open,
  onOpenChange,
}: CourseAnalyticsDetailDialogProps) {
  const { data, isLoading } = useMemberCourseAnalyticsDetail(
    memberId,
    courseId ?? undefined,
    open && !!courseId
  );

  const course = data?.course;
  const sections = data?.sections ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="text-lg">
            {decodeHtmlEntities(courseTitle)}
          </DialogTitle>
          <DialogDescription>
            Lecture-by-lecture watch progress for this learner.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {isLoading || !data ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-muted/40 rounded animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              {course ? (
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                  <SummaryStat
                    label="Completion"
                    value={`${course.completion_percent}%`}
                    sub={`${course.completed_lectures}/${course.total_lectures} videos`}
                  />
                  <SummaryStat
                    label="Watched"
                    value={formatDurationShort(course.watched_seconds)}
                    sub={
                      course.total_duration_seconds > 0
                        ? `of ${formatDurationShort(
                            course.total_duration_seconds
                          )}`
                        : "total duration unknown"
                    }
                  />
                  <SummaryStat
                    label="Time spent"
                    value={formatDurationShort(course.total_watch_seconds)}
                    sub="includes rewatches"
                  />
                  <SummaryStat
                    label="In progress"
                    value={String(
                      Math.max(
                        0,
                        course.touched_lectures - course.completed_lectures
                      )
                    )}
                    sub={`${course.not_started_lectures} not started`}
                  />
                </div>
              ) : null}

              {sections.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No lectures published in this course yet.
                </p>
              ) : (
                sections.map((section) => (
                  <div
                    key={section.section_id}
                    className="border rounded-lg overflow-hidden"
                  >
                    <div className="px-4 py-2 bg-muted/40 border-b">
                      <p className="text-sm font-semibold">
                        {decodeHtmlEntities(section.section_title)}
                      </p>
                    </div>
                    <div className="divide-y">
                      {section.lessons.map((lesson) => (
                        <div key={lesson.lesson_id} className="px-4 py-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            {decodeHtmlEntities(lesson.lesson_title)}
                          </p>
                          <div className="space-y-2">
                            {lesson.lectures.map((lecture) => {
                              const status = lecture.completed
                                ? "completed"
                                : lecture.watched_seconds > 0 ||
                                    lecture.total_watch_seconds > 0
                                  ? "in-progress"
                                  : "not-started";
                              const Icon =
                                status === "completed"
                                  ? CheckCircle2
                                  : status === "in-progress"
                                    ? PlayCircle
                                    : Circle;
                              const iconClass =
                                status === "completed"
                                  ? "text-emerald-500"
                                  : status === "in-progress"
                                    ? "text-blue-500"
                                    : "text-muted-foreground";
                              const hasDuration = lecture.duration_seconds > 0;
                              const showProgressBar = hasDuration;

                              let timeLabel: string;
                              if (!lecture.has_video) {
                                timeLabel = "No video";
                              } else if (hasDuration) {
                                timeLabel = `${formatDurationShort(
                                  lecture.watched_seconds
                                )} / ${formatDurationShort(
                                  lecture.duration_seconds
                                )}`;
                              } else if (lecture.watched_seconds > 0) {
                                timeLabel = `${formatDurationShort(
                                  lecture.watched_seconds
                                )} watched`;
                              } else {
                                timeLabel = "Duration not set";
                              }

                              return (
                                <div
                                  key={lecture.lecture_id}
                                  className="flex items-center gap-3"
                                >
                                  <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate">
                                      {decodeHtmlEntities(lecture.lecture_title)}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1">
                                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[200px]">
                                        {showProgressBar ? (
                                          <div
                                            className="h-full rounded-full bg-primary"
                                            style={{
                                              width: `${lecture.percent_watched}%`,
                                            }}
                                          />
                                        ) : status === "completed" ? (
                                          <div className="h-full rounded-full bg-primary w-full" />
                                        ) : null}
                                      </div>
                                      <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                                        {timeLabel}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-right">
                                        {hasDuration
                                          ? `${lecture.percent_watched}%`
                                          : status === "completed"
                                            ? "Done"
                                            : "-"}
                                      </span>
                                    </div>
                                  </div>
                                  {lecture.last_watched_at ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] gap-1 hidden md:inline-flex"
                                    >
                                      <Clock className="h-3 w-3" />
                                      {formatLastWatched(lecture.last_watched_at)}
                                    </Badge>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums leading-tight mt-0.5">
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
