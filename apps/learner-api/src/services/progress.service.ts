/**
 * Service for member lecture progress.
 * Requires enrollment for all operations.
 */

import { db } from "../db/connection";
import { NotFoundError } from "../errors/not-found.error";
import { BadRequestError } from "../errors/bad-request.error";
import courseService from "./course.service";
import certificateService from "./certificate.service";
import * as progressRepo from "../repositories/progress.repository";

/**
 * Standalone content lesson types, completion stored in member_lesson_progress.
 *
 * Imported rather than redeclared. This list was maintained here AND implied by
 * the completion service, and the copies had already drifted: PPT is a member of
 * the `lesson_type` enum but was missing here, so marking a PPT lesson complete
 * threw "Lesson is not a content lesson" and no learner could ever finish one.
 */
import { CONTENT_LESSON_TYPES } from "./course-completion.service";

export interface ProgressItem {
  lecture_id: string;
  completed: boolean;
  watched_duration: number;
  last_position_seconds: number;
  total_watch_seconds: number;
  last_watched_at: string;
}

/** Get progress for a member in a course. Requires enrollment. */
async function getProgress(
  tenantId: string,
  courseId: string,
  memberId: string
): Promise<{ progress: ProgressItem[] }> {
  await courseService.ensureEnrolled(tenantId, courseId, memberId);

  const rows = await progressRepo.findByMemberAndCourse(
    tenantId,
    memberId,
    courseId
  );

  const progress: ProgressItem[] = rows.map((r) => ({
    lecture_id: r.lecture_id,
    completed: r.completed,
    watched_duration: r.watched_duration,
    last_position_seconds: r.last_position_seconds,
    total_watch_seconds: r.total_watch_seconds,
    last_watched_at: r.last_watched_at.toISOString(),
  }));

  // Assignment completions live in their own table, but the clients flatten
  // assignments into the same curriculum list (keyed by assignment id) when
  // computing course progress. Surface them here as progress rows so a
  // completed assignment counts toward the course, otherwise a course with
  // any assignment can never reach 100%.
  const assignmentRows = await db
    .selectFrom("member_assignment_progress")
    .select(["assignment_id", "completed", "completed_at", "updated_at"])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("course_id", "=", courseId)
    .execute();

  for (const a of assignmentRows) {
    const at = a.completed_at ?? a.updated_at;
    progress.push({
      lecture_id: a.assignment_id,
      completed: a.completed,
      watched_duration: 0,
      last_position_seconds: 0,
      total_watch_seconds: 0,
      last_watched_at: (at instanceof Date ? at : new Date(at)).toISOString(),
    });
  }

  // Same for quizzes, completions live in member_quiz_progress, keyed by
  // quiz id on the clients. Without these rows a completed quiz loses its
  // checkmark on reload and re-locks the next lesson in sequential courses.
  const quizRows = await db
    .selectFrom("member_quiz_progress")
    .select(["quiz_id", "completed", "completed_at", "updated_at"])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("course_id", "=", courseId)
    .execute();

  for (const q of quizRows) {
    const at = q.completed_at ?? q.updated_at;
    progress.push({
      lecture_id: q.quiz_id,
      completed: q.completed,
      watched_duration: 0,
      last_position_seconds: 0,
      total_watch_seconds: 0,
      last_watched_at: (at instanceof Date ? at : new Date(at)).toISOString(),
    });
  }

  // Content lessons (PDF/LINK/TEXT/IMAGE) have no lectures row; their completion
  // lives in member_lesson_progress, keyed by the course_lessons id. The clients
  // key the curriculum list by lesson id, so surface lesson_id as lecture_id.
  // otherwise a completed content lesson loses its checkmark on reload and
  // re-locks the next lesson in sequential courses.
  const lessonRows = await progressRepo.findLessonProgressByMemberAndCourse(
    tenantId,
    memberId,
    courseId
  );

  for (const l of lessonRows) {
    const at = l.completed_at ?? l.updated_at;
    progress.push({
      lecture_id: l.lesson_id,
      completed: l.completed,
      watched_duration: 0,
      last_position_seconds: 0,
      total_watch_seconds: 0,
      last_watched_at: (at instanceof Date ? at : new Date(at)).toISOString(),
    });
  }

  return { progress };
}

/** Mark or unmark a lecture. Requires enrollment. Validates lecture belongs to course. */
async function markLectureComplete(
  tenantId: string,
  courseId: string,
  lectureId: string,
  memberId: string,
  completed: boolean
): Promise<{ progress: ProgressItem }> {
  const result = await upsertProgress(tenantId, courseId, lectureId, memberId, { completed });
  return result;
}

/**
 * Mark or unmark a standalone content lesson (PDF/LINK/TEXT/IMAGE) complete.
 * Content lessons have no auto-complete trigger (no video %, no submit), so this
 * manual flip is their only completion path, kept separate from the lecture
 * path because they have no `lectures` row. Requires enrollment.
 */
async function markLessonComplete(
  tenantId: string,
  courseId: string,
  lessonId: string,
  memberId: string,
  completed: boolean
): Promise<{ progress: ProgressItem }> {
  await courseService.ensureEnrolled(tenantId, courseId, memberId);

  const lesson = await db
    .selectFrom("course_lessons")
    .select(["id", "type"])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .where("id", "=", lessonId)
    .executeTakeFirst();

  if (!lesson) {
    throw new NotFoundError("Lesson not found in this course");
  }
  if (
    !CONTENT_LESSON_TYPES.includes(
      lesson.type as (typeof CONTENT_LESSON_TYPES)[number]
    )
  ) {
    throw new BadRequestError("Lesson is not a content lesson");
  }

  const row = await progressRepo.upsertLessonProgress(
    tenantId,
    memberId,
    courseId,
    lessonId,
    completed
  );

  if (completed && row.completed) {
    void certificateService.maybeIssueCourseCertificateOnCompletion(
      tenantId,
      courseId,
      memberId
    );
  }

  return {
    progress: {
      lecture_id: row.lesson_id,
      completed: row.completed,
      watched_duration: 0,
      last_position_seconds: 0,
      total_watch_seconds: 0,
      last_watched_at: (row.completed_at ?? row.updated_at).toISOString(),
    },
  };
}

/** Upsert progress (completed and/or watched_duration and/or last_position). Requires enrollment. */
async function upsertProgress(
  tenantId: string,
  courseId: string,
  lectureId: string,
  memberId: string,
  payload: { completed?: boolean; watchedDuration?: number; lastPosition?: number }
): Promise<{ progress: ProgressItem }> {
  await courseService.ensureEnrolled(tenantId, courseId, memberId);

  const lecture = await db
    .selectFrom("lectures")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .where("id", "=", lectureId)
    .executeTakeFirst();

  if (!lecture) {
    throw new NotFoundError("Lecture not found in this course");
  }

  const row = await progressRepo.upsertProgress(
    tenantId,
    memberId,
    courseId,
    lectureId,
    payload
  );

  // Auto-issue + email the course certificate the moment this completion pushes
  // the course to 100% (fire-and-forget; no-ops until fully complete).
  if (payload.completed === true && row.completed) {
    void certificateService.maybeIssueCourseCertificateOnCompletion(
      tenantId,
      courseId,
      memberId
    );
  }

  return {
    progress: {
      lecture_id: row.lecture_id,
      completed: row.completed,
      watched_duration: row.watched_duration,
      last_position_seconds: row.last_position_seconds,
      total_watch_seconds: row.total_watch_seconds,
      last_watched_at: row.last_watched_at.toISOString(),
    },
  };
}

/** Get user analytics for a course. Requires enrollment. */
async function getUserCourseAnalytics(
  tenantId: string,
  courseId: string,
  memberId: string
) {
  await courseService.ensureEnrolled(tenantId, courseId, memberId);

  // Get all progress rows for this member + course
  const progressRows = await progressRepo.findByMemberAndCourse(
    tenantId,
    memberId,
    courseId
  );

  // Get total lectures in this course
  const lectures = await db
    .selectFrom("lectures")
    .select(["id", "title"])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .execute();

  const totalLessons = lectures.length;
  const completedLessons = progressRows.filter((r) => r.completed).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Total time spent (sum of watched_duration)
  const totalTimeSpent = progressRows.reduce((sum, r) => sum + (r.watched_duration || 0), 0);

  // Time spent per lesson
  const lessonTimeSpent: Record<string, number> = {};
  for (const row of progressRows) {
    lessonTimeSpent[row.lecture_id] = row.watched_duration || 0;
  }

  // Determine start date (earliest progress entry), use created_at as fallback
  const toDate = (v: unknown): Date | null => {
    if (!v) return null;
    if (v instanceof Date) return v;
    const d = new Date(v as string);
    return isNaN(d.getTime()) ? null : d;
  };

  const allDates = progressRows
    .flatMap((r) => [toDate(r.last_watched_at), toDate(r.created_at)])
    .filter((d): d is Date => d !== null);
  allDates.sort((a, b) => a.getTime() - b.getTime());
  const startedAt = allDates.length > 0 ? allDates[0].toISOString() : undefined;
  const lastActiveAt = allDates.length > 0 ? allDates[allDates.length - 1].toISOString() : undefined;

  // Completion date
  const completedAt = progressPercent >= 100 && lastActiveAt ? lastActiveAt : undefined;

  // Calculate streak (consecutive days with activity)
  const activityDates = new Set(
    progressRows
      .flatMap((r) => [toDate(r.last_watched_at), toDate(r.created_at)])
      .filter((d): d is Date => d !== null)
      .map((d) => d.toISOString().split("T")[0])
  );
  // Walk back from today over the set of active UTC dates. A single grace day
  // is allowed only at the start (so a streak still counts if the learner
  // hasn't watched *today* yet, it ends yesterday) and never bridges a gap.
  let currentStreak = 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  if (!activityDates.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (activityDates.has(cursor.toISOString().slice(0, 10))) {
    currentStreak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // Daily activity (last 30 days), use the most relevant date per row
  const dailyActivity: Array<{ date: string; count: number }> = [];
  const rowDateStrings = progressRows.map((r) => {
    const d = toDate(r.last_watched_at) || toDate(r.updated_at) || toDate(r.created_at);
    return d ? d.toISOString().split("T")[0] : null;
  });
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = rowDateStrings.filter((rd) => rd === dateStr).length;
    dailyActivity.push({ date: dateStr, count });
  }

  // Quiz scores, count any finished attempt (PASSED or FAILED). The enum
  // is `IN_PROGRESS | PASSED | FAILED`; an earlier version of this query
  // looked for a "COMPLETED" value that doesn't exist and was cast through
  // `as never` to dodge the type check, which threw a Postgres enum-cast
  // error at runtime when the analytics endpoint was hit.
  const quizAttempts = await db
    .selectFrom("quiz_attempts")
    .innerJoin("quizzes", "quizzes.id", "quiz_attempts.quiz_id")
    .select([
      "quizzes.title as quiz_title",
      "quiz_attempts.score",
      "quiz_attempts.total_marks",
    ])
    .where("quiz_attempts.tenant_id", "=", tenantId)
    .where("quiz_attempts.tenant_member_id", "=", memberId)
    .where("quizzes.course_id", "=", courseId)
    .where("quiz_attempts.status", "in", ["PASSED", "FAILED"])
    .execute();

  const quizScores = quizAttempts.map((qa) => {
    const score = typeof qa.score === "string" ? parseFloat(qa.score) : Number(qa.score ?? 0);
    const maxScore = typeof qa.total_marks === "string" ? parseFloat(qa.total_marks) : Number(qa.total_marks ?? 0);
    return {
      quizTitle: qa.quiz_title ?? "Quiz",
      score,
      maxScore,
      percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    };
  });

  // Assignment scores via evaluations join
  const assignmentEvaluations = await db
    .selectFrom("assignment_evaluations")
    .innerJoin("assignments", "assignments.id", "assignment_evaluations.assignment_id")
    .select([
      "assignments.title as assignment_title",
      "assignment_evaluations.score",
      "assignment_evaluations.max_score",
    ])
    .where("assignment_evaluations.tenant_id", "=", tenantId)
    .where("assignment_evaluations.tenant_member_id", "=", memberId)
    .where("assignments.course_id", "=", courseId)
    .execute();

  const assignmentScores = assignmentEvaluations.map((ae) => {
    const score = typeof ae.score === "string" ? parseFloat(ae.score) : Number(ae.score ?? 0);
    const maxScore = typeof ae.max_score === "string" ? parseFloat(ae.max_score) : Number(ae.max_score ?? 0);
    return {
      assignmentTitle: ae.assignment_title ?? "Assignment",
      score,
      maxScore,
      percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    };
  });

  return {
    totalTimeSpent,
    lessonTimeSpent,
    completedLessons,
    totalLessons,
    progressPercent,
    quizScores,
    assignmentScores,
    currentStreak,
    lastActiveAt,
    startedAt,
    completedAt,
    dailyActivity,
  };
}

/**
 * Per-video (lecture) analytics for a member in a course, with cohort
 * comparison. Requires enrollment. "Time spent" uses total_watch_seconds and
 * falls back to watched_duration when the cumulative total is 0.
 */
async function getCourseVideoAnalytics(
  tenantId: string,
  courseId: string,
  memberId: string
) {
  await courseService.ensureEnrolled(tenantId, courseId, memberId);

  const course = await db
    .selectFrom("courses")
    .select(["id", "title"])
    .where("tenant_id", "=", tenantId)
    .where("id", "=", courseId)
    .executeTakeFirst();

  if (!course) {
    throw new NotFoundError("Course not found");
  }

  const [lectures, myProgress, cohortAverages, cohortTotals] = await Promise.all([
    progressRepo.getCourseLecturesOrdered(tenantId, courseId),
    progressRepo.findByMemberAndCourse(tenantId, memberId, courseId),
    progressRepo.getCourseLectureCohortAverages(tenantId, courseId),
    progressRepo.getCourseCohortTotals(tenantId, courseId),
  ]);

  const totalVideos = lectures.length;
  const avgProgressPercent = await progressRepo.getCourseAvgCompletionPercent(
    tenantId,
    courseId,
    totalVideos
  );

  // Index this member's progress + cohort averages by lecture id.
  const myByLecture = new Map(myProgress.map((p) => [p.lecture_id, p]));
  const avgByLecture = new Map(cohortAverages.map((a) => [a.lecture_id, a]));

  // "Time spent" = total_watch_seconds, fall back to watched_duration when 0.
  const mySeconds = (lectureId: string): number => {
    const p = myByLecture.get(lectureId);
    if (!p) return 0;
    return p.total_watch_seconds > 0 ? p.total_watch_seconds : p.watched_duration || 0;
  };

  const videos = lectures.map((l) => {
    const agg = avgByLecture.get(l.lecture_id);
    const peers = agg?.peers ?? 0;
    const p = myByLecture.get(l.lecture_id);
    return {
      lectureId: l.lecture_id,
      title: l.title,
      sectionTitle: l.section_title,
      durationSeconds: l.duration_seconds,
      yourSeconds: Math.round(mySeconds(l.lecture_id)),
      avgSeconds: Math.round(agg?.avg_seconds ?? 0),
      yourCompleted: p?.completed ?? false,
      peerCompletionPercent:
        peers > 0 ? Math.round(((agg?.completed_peers ?? 0) / peers) * 100) : 0,
    };
  });

  const yourTotalSeconds = lectures.reduce(
    (sum, l) => sum + mySeconds(l.lecture_id),
    0
  );
  const yourCompletedVideos = videos.filter((v) => v.yourCompleted).length;
  const yourProgressPercent =
    totalVideos > 0 ? Math.round((yourCompletedVideos / totalVideos) * 100) : 0;

  const peerCount = cohortTotals.peerCount;
  const avgTotalSeconds =
    peerCount > 0 ? Math.round(cohortTotals.sumTotalSeconds / peerCount) : 0;

  return {
    course: { id: course.id, title: course.title },
    summary: {
      yourTotalSeconds: Math.round(yourTotalSeconds),
      avgTotalSeconds,
      yourCompletedVideos,
      totalVideos,
      yourProgressPercent,
      avgProgressPercent,
      peerCount,
    },
    videos,
  };
}

const progressService = {
  getProgress,
  markLectureComplete,
  markLessonComplete,
  upsertProgress,
  getUserCourseAnalytics,
  getCourseVideoAnalytics,
};

export default progressService;
