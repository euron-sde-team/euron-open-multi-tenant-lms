import { sql } from "kysely";

import { db } from "../db/connection";

/**
 * COURSE COMPLETION, the single definition of "has this learner finished this
 * course?"
 *
 * ONE definition, used everywhere. This is the whole point of the file.
 *
 * The certificate already had this logic, inlined in the middle of its issuance
 * method. Sequential courses needs exactly the same question answered. Copying
 * it would have been two definitions that agree today and drift tomorrow, and
 * the failure mode is nasty and silent: a learner claims their certificate for
 * course A, then finds course B still locked, because "complete" meant two
 * different things in two files. So both callers now come here.
 *
 * WHAT COUNTS: every lecture + every PUBLISHED assignment + every PUBLISHED
 * quiz + every CONTENT LESSON. Not just videos. That distinction was a real bug
 * the certificate fixed: counting lectures alone let a course made entirely of
 * assignments look "complete" with zero work done, and let a learner skip every
 * assignment and quiz while still claiming the cert as long as the videos were
 * watched.
 *
 * Content lessons (PDF/PPT/LINK/TEXT/IMAGE) were the same bug one layer down.
 * They are rows in `course_lessons` with no `lectures` row, so they were absent
 * from this count entirely, while the player still showed the learner a "mark
 * as complete" toggle for them. Ticking it changed nothing, and the sidebar
 * counted them toward "61/61 lessons" while the gate did not. A learner
 * therefore saw 100% and was refused with "56/58 items completed", with nothing
 * on screen explaining which two. That is the ticket this fixes.
 *
 * (`lectures` has no status column, every row is live, so there is nothing to
 * filter there. Assignments and quizzes do, and drafts must not be counted:
 * an admin drafting a new quiz would otherwise instantly un-complete the course
 * for everyone who had already finished it.)
 */

/**
 * Lesson types whose completion lives in `member_lesson_progress` rather than
 * behind a lecture, assignment or quiz.
 *
 * Must stay in step with the `lesson_type` enum. PPT was missing from the
 * player's copy of this list, so a PPT lesson threw "Lesson is not a content
 * lesson" and could never be completed by anyone.
 */
export const CONTENT_LESSON_TYPES = [
  "PDF",
  "PPT",
  "LINK",
  "TEXT",
  "IMAGE",
] as const;

export interface CompletionProgress {
  done: number;
  total: number;
  /**
   * The per-type split. The certificate prints "12 lessons completed, 3 quizzes
   * passed", so it needs more than the total, and it must not re-query to get
   * it, or we are back to two definitions counting two different things.
   */
  lecturesCompleted: number;
  assignmentsCompleted: number;
  quizzesCompleted: number;
  contentLessonsCompleted: number;
  /**
   * True only when total > 0 and done >= total.
   *
   * An EMPTY course (no lectures, no assignments, no quizzes) is NOT complete.
   * 0 >= 0 is true, and that arithmetic would quietly mark every learner as
   * having finished a course with no content, unlocking whatever sits behind
   * it. The certificate refuses to issue for an empty course for the same
   * reason; here we simply report it as not complete.
   */
  complete: boolean;
}

class CourseCompletionService {
  /**
   * How far through a course this learner is, and whether they're done.
   *
   * Six counts in two parallel round-trips. Called on the course-page and
   * player paths, so it must not fan out per item, this is why the totals are
   * `count(*)` aggregates rather than fetching rows and counting in JS.
   */
  async getProgress(
    tenantId: string,
    memberId: string,
    courseId: string
  ): Promise<CompletionProgress> {
    const [total, done] = await Promise.all([
      this.countItems(tenantId, courseId),
      this.countCompleted(tenantId, memberId, courseId),
    ]);

    const doneTotal =
      done.lecturesCompleted +
      done.assignmentsCompleted +
      done.quizzesCompleted +
      done.contentLessonsCompleted;

    return {
      ...done,
      done: doneTotal,
      total,
      complete: total > 0 && doneTotal >= total,
    };
  }

  /**
   * The items this learner still owes, by name.
   *
   * "56/58 items completed" tells a learner nothing they can act on, and it is
   * the reason this reaches support instead of resolving itself: the player
   * shows 100% while the gate disagrees, and no screen names the difference.
   * Callers use this to say WHICH two.
   *
   * Capped, because the message is for a human. A learner three items in does
   * not need all fifty-five listed.
   */
  async getOutstandingItems(
    tenantId: string,
    memberId: string,
    courseId: string,
    limit = 5
  ): Promise<Array<{ kind: string; title: string }>> {
    const [lectures, assignments, quizzes, contentLessons] = await Promise.all([
      db
        .selectFrom("lectures as l")
        .select(["l.title as title"])
        .where("l.tenant_id", "=", tenantId)
        .where("l.course_id", "=", courseId)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("member_lecture_progress as p")
                .select("p.id")
                .whereRef("p.lecture_id", "=", "l.id")
                .where("p.tenant_member_id", "=", memberId)
                .where("p.completed", "=", true)
            )
          )
        )
        .execute(),
      db
        .selectFrom("assignments as a")
        .select(["a.title as title"])
        .where("a.tenant_id", "=", tenantId)
        .where("a.course_id", "=", courseId)
        .where("a.status", "=", "PUBLISHED")
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("member_assignment_progress as p")
                .select("p.id")
                .whereRef("p.assignment_id", "=", "a.id")
                .where("p.tenant_member_id", "=", memberId)
                .where("p.completed", "=", true)
            )
          )
        )
        .execute(),
      db
        .selectFrom("quizzes as q")
        .select(["q.title as title"])
        .where("q.tenant_id", "=", tenantId)
        .where("q.course_id", "=", courseId)
        .where("q.status", "=", "PUBLISHED")
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("member_quiz_progress as p")
                .select("p.id")
                .whereRef("p.quiz_id", "=", "q.id")
                .where("p.tenant_member_id", "=", memberId)
                .where("p.completed", "=", true)
            )
          )
        )
        .execute(),
      db
        .selectFrom("course_lessons as cl")
        .select(["cl.title as title"])
        .where("cl.tenant_id", "=", tenantId)
        .where("cl.course_id", "=", courseId)
        .where("cl.type", "in", [...CONTENT_LESSON_TYPES])
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("member_lesson_progress as p")
                .select("p.id")
                .whereRef("p.lesson_id", "=", "cl.id")
                .where("p.tenant_member_id", "=", memberId)
                .where("p.completed", "=", true)
            )
          )
        )
        .execute(),
    ]);

    return [
      ...lectures.map((r) => ({ kind: "Lesson", title: r.title })),
      ...assignments.map((r) => ({ kind: "Assignment", title: r.title })),
      ...quizzes.map((r) => ({ kind: "Quiz", title: r.title })),
      ...contentLessons.map((r) => ({ kind: "Lesson", title: r.title })),
    ].slice(0, limit);
  }

  /** Just the verdict, for callers that don't need the numbers. */
  async isComplete(
    tenantId: string,
    memberId: string,
    courseId: string
  ): Promise<boolean> {
    const { complete } = await this.getProgress(tenantId, memberId, courseId);
    return complete;
  }

  /**
   * Everything a learner must finish: lectures + published assignments +
   * published quizzes.
   */
  private async countItems(
    tenantId: string,
    courseId: string
  ): Promise<number> {
    const [lectures, assignments, quizzes, contentLessons] = await Promise.all([
      db
        .selectFrom("lectures")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("tenant_id", "=", tenantId)
        .where("course_id", "=", courseId)
        .executeTakeFirst(),
      db
        .selectFrom("assignments")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("tenant_id", "=", tenantId)
        .where("course_id", "=", courseId)
        .where("status", "=", "PUBLISHED")
        .executeTakeFirst(),
      db
        .selectFrom("quizzes")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("tenant_id", "=", tenantId)
        .where("course_id", "=", courseId)
        .where("status", "=", "PUBLISHED")
        .executeTakeFirst(),
      db
        .selectFrom("course_lessons")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("tenant_id", "=", tenantId)
        .where("course_id", "=", courseId)
        .where("type", "in", [...CONTENT_LESSON_TYPES])
        .executeTakeFirst(),
    ]);

    return (
      (lectures?.count ?? 0) +
      (assignments?.count ?? 0) +
      (quizzes?.count ?? 0) +
      (contentLessons?.count ?? 0)
    );
  }

  /** How many of those the learner has actually completed. */
  private async countCompleted(
    tenantId: string,
    memberId: string,
    courseId: string
  ): Promise<{
    lecturesCompleted: number;
    assignmentsCompleted: number;
    quizzesCompleted: number;
    contentLessonsCompleted: number;
  }> {
    const [lectures, assignments, quizzes, contentLessons] = await Promise.all([
      db
        .selectFrom("member_lecture_progress")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("course_id", "=", courseId)
        .where("completed", "=", true)
        .executeTakeFirst(),
      db
        .selectFrom("member_assignment_progress")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("course_id", "=", courseId)
        .where("completed", "=", true)
        .executeTakeFirst(),
      db
        .selectFrom("member_quiz_progress")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("course_id", "=", courseId)
        .where("completed", "=", true)
        .executeTakeFirst(),
      // Joined back to course_lessons so a progress row left behind by a lesson
      // that was deleted, or whose type was changed away from a content type,
      // cannot count toward a course it no longer belongs to.
      db
        .selectFrom("member_lesson_progress as mlp")
        .innerJoin("course_lessons as cl", "cl.id", "mlp.lesson_id")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("mlp.tenant_id", "=", tenantId)
        .where("mlp.tenant_member_id", "=", memberId)
        .where("mlp.course_id", "=", courseId)
        .where("mlp.completed", "=", true)
        .where("cl.type", "in", [...CONTENT_LESSON_TYPES])
        .executeTakeFirst(),
    ]);

    return {
      lecturesCompleted: lectures?.count ?? 0,
      assignmentsCompleted: assignments?.count ?? 0,
      quizzesCompleted: quizzes?.count ?? 0,
      contentLessonsCompleted: contentLessons?.count ?? 0,
    };
  }
}

export default new CourseCompletionService();
