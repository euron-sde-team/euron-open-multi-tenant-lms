import { BadRequestError } from "../errors/bad-request.error";
import memberCourseAnalyticsRepository, {
  type CourseAnalyticsSummaryRow,
  type CourseLectureProgressRow,
  type ExportLectureRow,
  type MemberAssignmentAnalyticsRow,
  type MemberQuizAnalyticsRow,
} from "../repositories/member-course-analytics.repository";

export interface CourseAnalyticsSummary {
  course_id: string;
  course_title: string;
  course_slug: string;
  course_mode: string;
  enrollment_id: string;
  enrollment_status: string;
  enrollment_source: string;
  enrolled_at: string;
  completed_at: string | null;
  total_lectures: number;
  touched_lectures: number;
  completed_lectures: number;
  not_started_lectures: number;
  completion_percent: number;
  total_duration_seconds: number;
  watched_seconds: number;
  total_watch_seconds: number;
  last_activity_at: string | null;
}

export interface LectureAnalyticsItem {
  lecture_id: string;
  lecture_title: string;
  duration_seconds: number;
  watched_seconds: number;
  total_watch_seconds: number;
  last_position_seconds: number;
  completed: boolean;
  percent_watched: number;
  last_watched_at: string | null;
  has_video: boolean;
}

export interface LessonAnalyticsGroup {
  lesson_id: string;
  lesson_title: string;
  lesson_sort: number;
  lectures: LectureAnalyticsItem[];
}

export interface SectionAnalyticsGroup {
  section_id: string;
  section_title: string;
  section_sort: number;
  lessons: LessonAnalyticsGroup[];
}

export interface CourseAnalyticsDetail {
  course: {
    course_id: string;
    course_title: string;
    total_lectures: number;
    touched_lectures: number;
    completed_lectures: number;
    not_started_lectures: number;
    completion_percent: number;
    total_duration_seconds: number;
    watched_seconds: number;
    total_watch_seconds: number;
  };
  sections: SectionAnalyticsGroup[];
}

export interface CourseAnalyticsExportLectureRow {
  course_id: string;
  course_title: string;
  section_title: string;
  lesson_title: string;
  lecture_id: string;
  lecture_title: string;
  duration_seconds: number;
  watched_seconds: number;
  total_watch_seconds: number;
  last_position_seconds: number;
  completed: boolean;
  percent_watched: number;
  last_watched_at: string | null;
}

export interface QuizAnalyticsItem {
  quiz_id: string;
  quiz_title: string;
  course_id: string;
  course_title: string;
  max_score: number;
  pass_percentage: number;
  attempt_count: number;
  best_score: number;
  best_total_marks: number;
  best_percentage: number;
  /** "PASSED" | "FAILED" | "IN_PROGRESS" | "NOT_ATTEMPTED" */
  status: string;
  last_attempt_at: string | null;
}

export interface AssignmentAnalyticsItem {
  assignment_id: string;
  assignment_title: string;
  course_id: string;
  course_title: string;
  max_score: number;
  due_date: string | null;
  /** submission_status or "NOT_SUBMITTED" */
  submission_status: string;
  submitted_at: string | null;
  score: number | null;
  score_percentage: number | null;
  is_evaluated: boolean;
  is_late: boolean | null;
  feedback: string | null;
  evaluated_at: string | null;
}

export interface QuizAnalyticsSummary {
  total_quizzes: number;
  attempted: number;
  passed: number;
  average_best_percent: number | null;
}

export interface AssignmentAnalyticsSummary {
  total_assignments: number;
  submitted: number;
  evaluated: number;
  average_score_percent: number | null;
}

export interface QuizAnalyticsResponse {
  summary: QuizAnalyticsSummary;
  quizzes: QuizAnalyticsItem[];
}

export interface AssignmentAnalyticsResponse {
  summary: AssignmentAnalyticsSummary;
  assignments: AssignmentAnalyticsItem[];
}

export interface CourseAnalyticsExportPayload {
  summary: CourseAnalyticsSummary[];
  lectures: CourseAnalyticsExportLectureRow[];
  quizzes: QuizAnalyticsItem[];
  assignments: AssignmentAnalyticsItem[];
}

const toInt = (val: unknown): number => {
  if (val == null) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "string") {
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return Number(val) || 0;
};

const toIso = (val: Date | null | undefined): string | null => {
  if (!val) return null;
  return val instanceof Date ? val.toISOString() : new Date(val).toISOString();
};

const pct = (numerator: number, denominator: number): number => {
  if (!denominator || denominator <= 0) return 0;
  const value = (numerator / denominator) * 100;
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
};

const normalizeSummary = (
  row: CourseAnalyticsSummaryRow
): CourseAnalyticsSummary => {
  const totalLectures = toInt(row.total_lectures);
  const completedLectures = toInt(row.completed_lectures);
  const touchedLectures = toInt(row.touched_lectures);
  return {
    course_id: row.course_id,
    course_title: row.course_title,
    course_slug: row.course_slug,
    course_mode: row.course_mode,
    enrollment_id: row.enrollment_id,
    enrollment_status: row.enrollment_status,
    enrollment_source: row.enrollment_source,
    enrolled_at: toIso(row.enrolled_at) ?? new Date().toISOString(),
    completed_at: toIso(row.completed_at),
    total_lectures: totalLectures,
    touched_lectures: touchedLectures,
    completed_lectures: completedLectures,
    not_started_lectures: Math.max(0, totalLectures - touchedLectures),
    completion_percent: pct(completedLectures, totalLectures),
    total_duration_seconds: toInt(row.total_duration_seconds),
    watched_seconds: toInt(row.watched_seconds),
    total_watch_seconds: toInt(row.total_watch_seconds),
    last_activity_at: toIso(row.last_activity_at),
  };
};

const buildLectureItem = (row: CourseLectureProgressRow): LectureAnalyticsItem => {
  const duration = toInt(row.duration_seconds);
  const watched = toInt(row.watched_seconds);
  const totalWatch = toInt(row.total_watch_seconds);
  // "Has video" is a fact about the lecture, not about whether a duration was
  // entered. If the lecture has a video_provider, or the learner has actually
  // watched/started anything, treat it as a video for display purposes.
  const hasVideo =
    row.video_provider != null || watched > 0 || totalWatch > 0 || row.completed;
  return {
    lecture_id: row.lecture_id,
    lecture_title: row.lecture_title,
    duration_seconds: duration,
    watched_seconds: watched,
    total_watch_seconds: totalWatch,
    last_position_seconds: toInt(row.last_position_seconds),
    completed: row.completed,
    percent_watched: pct(watched, duration),
    last_watched_at: toIso(row.last_watched_at),
    has_video: hasVideo,
  };
};

const normalizeQuizItem = (row: MemberQuizAnalyticsRow): QuizAnalyticsItem => {
  const attemptCount = toInt(row.attempt_count);
  const passed = row.passed === true;
  // Derive a display status: never attempted → NOT_ATTEMPTED; otherwise use
  // the most-recent attempt status, but always prefer PASSED if any attempt
  // passed (an earlier fail shouldn't mask a later pass).
  let status: string;
  if (attemptCount === 0) {
    status = "NOT_ATTEMPTED";
  } else if (passed) {
    status = "PASSED";
  } else {
    status = row.last_status ?? "IN_PROGRESS";
  }
  return {
    quiz_id: row.quiz_id,
    quiz_title: row.quiz_title,
    course_id: row.course_id,
    course_title: row.course_title,
    max_score: toInt(row.max_score),
    pass_percentage: toInt(row.pass_percentage),
    attempt_count: attemptCount,
    best_score: toInt(row.best_score),
    best_total_marks: toInt(row.best_total_marks),
    best_percentage: toInt(row.best_percentage),
    status,
    last_attempt_at: toIso(row.last_attempt_at),
  };
};

const normalizeAssignmentItem = (
  row: MemberAssignmentAnalyticsRow
): AssignmentAnalyticsItem => {
  const submissionStatus = row.submission_status ?? "NOT_SUBMITTED";
  const isEvaluated = row.evaluated_at != null;
  const score = isEvaluated ? toInt(row.score) : null;
  // Evaluation max_score is the source of truth for the percentage; fall back
  // to the assignment's max_score if the evaluation didn't carry one.
  const evalMax = toInt(row.eval_max_score);
  const maxScore = toInt(row.max_score);
  const denom = evalMax > 0 ? evalMax : maxScore;
  const scorePercentage =
    score != null && denom > 0 ? pct(score, denom) : null;
  let isLate: boolean | null = null;
  if (row.due_date && row.submitted_at) {
    isLate = new Date(row.submitted_at) > new Date(row.due_date);
  }
  return {
    assignment_id: row.assignment_id,
    assignment_title: row.assignment_title,
    course_id: row.course_id,
    course_title: row.course_title,
    max_score: maxScore,
    due_date: toIso(row.due_date),
    submission_status: submissionStatus,
    submitted_at: toIso(row.submitted_at),
    score,
    score_percentage: scorePercentage,
    is_evaluated: isEvaluated,
    is_late: isLate,
    feedback: row.feedback,
    evaluated_at: toIso(row.evaluated_at),
  };
};

const summarizeQuizzes = (items: QuizAnalyticsItem[]): QuizAnalyticsSummary => {
  const attempted = items.filter((q) => q.attempt_count > 0);
  const passed = items.filter((q) => q.status === "PASSED").length;
  const avg =
    attempted.length > 0
      ? Math.round(
          attempted.reduce((a, q) => a + q.best_percentage, 0) /
            attempted.length
        )
      : null;
  return {
    total_quizzes: items.length,
    attempted: attempted.length,
    passed,
    average_best_percent: avg,
  };
};

const summarizeAssignments = (
  items: AssignmentAnalyticsItem[]
): AssignmentAnalyticsSummary => {
  const submitted = items.filter(
    (a) => a.submission_status !== "NOT_SUBMITTED"
  ).length;
  const evaluated = items.filter((a) => a.is_evaluated);
  const withPct = evaluated.filter(
    (a): a is AssignmentAnalyticsItem & { score_percentage: number } =>
      a.score_percentage != null
  );
  const avg =
    withPct.length > 0
      ? Math.round(
          withPct.reduce((a, x) => a + x.score_percentage, 0) / withPct.length
        )
      : null;
  return {
    total_assignments: items.length,
    submitted,
    evaluated: evaluated.length,
    average_score_percent: avg,
  };
};

class MemberCourseAnalyticsService {
  async getCourseSummary(
    tenantId: string,
    memberId: string
  ): Promise<CourseAnalyticsSummary[]> {
    if (!tenantId) throw new BadRequestError("Tenant context required");
    if (!memberId) throw new BadRequestError("Member id is required");

    const rows = await memberCourseAnalyticsRepository.getCourseSummary(
      tenantId,
      memberId
    );
    return rows.map(normalizeSummary);
  }

  async getCourseDetail(
    tenantId: string,
    memberId: string,
    courseId: string
  ): Promise<CourseAnalyticsDetail> {
    if (!tenantId) throw new BadRequestError("Tenant context required");
    if (!memberId) throw new BadRequestError("Member id is required");
    if (!courseId) throw new BadRequestError("Course id is required");

    const [summaryRows, lectureRows] = await Promise.all([
      memberCourseAnalyticsRepository.getCourseSummary(tenantId, memberId),
      memberCourseAnalyticsRepository.getCourseLectureBreakdown(
        tenantId,
        memberId,
        courseId
      ),
    ]);

    const summaryRow = summaryRows.find((r) => r.course_id === courseId);
    const summary = summaryRow ? normalizeSummary(summaryRow) : undefined;
    const courseTitle = summary?.course_title ?? "Course";

    const sections: SectionAnalyticsGroup[] = [];
    const sectionIndex = new Map<string, SectionAnalyticsGroup>();
    const lessonIndex = new Map<string, LessonAnalyticsGroup>();

    for (const row of lectureRows) {
      let section = sectionIndex.get(row.section_id);
      if (!section) {
        section = {
          section_id: row.section_id,
          section_title: row.section_title,
          section_sort: row.section_sort,
          lessons: [],
        };
        sectionIndex.set(row.section_id, section);
        sections.push(section);
      }
      const lessonKey = `${row.section_id}:${row.lesson_id}`;
      let lesson = lessonIndex.get(lessonKey);
      if (!lesson) {
        lesson = {
          lesson_id: row.lesson_id,
          lesson_title: row.lesson_title,
          lesson_sort: row.lesson_sort,
          lectures: [],
        };
        lessonIndex.set(lessonKey, lesson);
        section.lessons.push(lesson);
      }
      lesson.lectures.push(buildLectureItem(row));
    }

    const totalLectures = summary ? summary.total_lectures : lectureRows.length;
    const completedLectures = summary
      ? summary.completed_lectures
      : lectureRows.filter((r) => r.completed).length;
    const touchedLectures = summary
      ? summary.touched_lectures
      : lectureRows.filter((r) => r.last_watched_at != null).length;

    return {
      course: {
        course_id: courseId,
        course_title: courseTitle,
        total_lectures: totalLectures,
        touched_lectures: touchedLectures,
        completed_lectures: completedLectures,
        not_started_lectures: Math.max(0, totalLectures - touchedLectures),
        completion_percent: pct(completedLectures, totalLectures),
        total_duration_seconds: summary?.total_duration_seconds ?? 0,
        watched_seconds: summary?.watched_seconds ?? 0,
        total_watch_seconds: summary?.total_watch_seconds ?? 0,
      },
      sections,
    };
  }

  async getQuizAnalytics(
    tenantId: string,
    memberId: string
  ): Promise<QuizAnalyticsResponse> {
    if (!tenantId) throw new BadRequestError("Tenant context required");
    if (!memberId) throw new BadRequestError("Member id is required");

    const rows = await memberCourseAnalyticsRepository.getMemberQuizAnalytics(
      tenantId,
      memberId
    );
    const quizzes = rows.map(normalizeQuizItem);
    return { summary: summarizeQuizzes(quizzes), quizzes };
  }

  async getAssignmentAnalytics(
    tenantId: string,
    memberId: string
  ): Promise<AssignmentAnalyticsResponse> {
    if (!tenantId) throw new BadRequestError("Tenant context required");
    if (!memberId) throw new BadRequestError("Member id is required");

    const rows =
      await memberCourseAnalyticsRepository.getMemberAssignmentAnalytics(
        tenantId,
        memberId
      );
    const assignments = rows.map(normalizeAssignmentItem);
    return { summary: summarizeAssignments(assignments), assignments };
  }

  async getExportPayload(
    tenantId: string,
    memberId: string
  ): Promise<CourseAnalyticsExportPayload> {
    if (!tenantId) throw new BadRequestError("Tenant context required");
    if (!memberId) throw new BadRequestError("Member id is required");

    const [summaryRows, lectureRows, quizRows, assignmentRows] =
      await Promise.all([
        memberCourseAnalyticsRepository.getCourseSummary(tenantId, memberId),
        memberCourseAnalyticsRepository.getAllLecturesForExport(
          tenantId,
          memberId
        ),
        memberCourseAnalyticsRepository.getMemberQuizAnalytics(
          tenantId,
          memberId
        ),
        memberCourseAnalyticsRepository.getMemberAssignmentAnalytics(
          tenantId,
          memberId
        ),
      ]);

    const lectures: CourseAnalyticsExportLectureRow[] = lectureRows.map(
      (row: ExportLectureRow) => {
        const duration = toInt(row.duration_seconds);
        const watched = toInt(row.watched_seconds);
        return {
          course_id: row.course_id,
          course_title: row.course_title,
          section_title: row.section_title,
          lesson_title: row.lesson_title,
          lecture_id: row.lecture_id,
          lecture_title: row.lecture_title,
          duration_seconds: duration,
          watched_seconds: watched,
          total_watch_seconds: toInt(row.total_watch_seconds),
          last_position_seconds: toInt(row.last_position_seconds),
          completed: row.completed,
          percent_watched: pct(watched, duration),
          last_watched_at: toIso(row.last_watched_at),
        };
      }
    );

    return {
      summary: summaryRows.map(normalizeSummary),
      lectures,
      quizzes: quizRows.map(normalizeQuizItem),
      assignments: assignmentRows.map(normalizeAssignmentItem),
    };
  }
}

export default new MemberCourseAnalyticsService();
