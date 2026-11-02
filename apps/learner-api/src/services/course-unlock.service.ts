import logger from "../utils/logger";

import courseCompletionService from "./course-completion.service";

import { db } from "../db/connection";

/**
 * SEQUENTIAL COURSES, the learner side.
 *
 * A course can name one offering that must be finished before it opens
 * (`courses.unlocks_after_id`). NULL, the default on all 104 courses today.
 * means anyone can start it, so this whole file is a no-op for every tenant that
 * hasn't set a prerequisite.
 */

export interface LockState {
  locked: boolean;
  /** What they must finish. Present only when locked. */
  blockedBy?: {
    id: string;
    title: string;
    slug: string;
    /** "You're 7 of 12 lessons through it", the padlock needs this. */
    done: number;
    total: number;
  };
}

/**
 * THE COMPLETION PORT.
 *
 * The one question this feature rests on: has this member finished that course?
 *
 * It is answered by `course-completion.service.ts`, which is the SINGLE
 * definition of "complete", the same one the certificate uses. That shared
 * definition is deliberate. If the lock and the certificate ever disagreed you
 * would get a learner who can claim their certificate for course A but still
 * finds course B locked, and nothing on screen would explain why.
 */
export interface CompletionAdapter {
  /**
   * ONE call, returning the verdict AND the numbers.
   *
   * Deliberately not `isComplete()` + `progress()`. Two methods meant `check()`
   * asked "are they done?", which counted everything and threw the counts away
   *, and then immediately asked "how far along are they?", running the same six
   * aggregate COUNTs a second time for a single page-open. The lock is now
   * evaluated on every content write (ensureEnrolled), so that waste sits on the
   * hot path. One question, one round of queries.
   *
   * The numbers are needed regardless: the padlock says "you're 7 of 12 lessons
   * through it", and a bare "Locked" is a dead end.
   */
  status(
    tenantId: string,
    memberId: string,
    offeringId: string
  ): Promise<{ complete: boolean; done: number; total: number }>;
}

const courseCompletion: CompletionAdapter = {
  status: (tenantId, memberId, offeringId) =>
    courseCompletionService.getProgress(tenantId, memberId, offeringId),
};

/**
 * One adapter per offering type. THIS MAP IS THE WHOLE EXTENSIBILITY STORY:
 * adding books later is one entry here plus one enum value in the schema.
 * no migration, no new column, no query changes.
 *
 * BOOK is nearly free when it comes (`member_book_progress.completed` is a real
 * boolean). TEST_SERIES needs a product decision first, is "complete"
 * *attempted*, *scored ≥ X%*, or *passed the series' own mark*? Don't guess.
 */
const ADAPTERS: Record<string, CompletionAdapter> = {
  COURSE: courseCompletion,
};

class CourseUnlockService {
  /**
   * Is this course locked for this member?
   *
   * Cheap by design: one indexed read of the course row, and it returns
   * immediately when there's no prerequisite, which is every course, for every
   * tenant, until someone sets one.
   */
  async check(
    tenantId: string,
    courseId: string,
    memberId: string
  ): Promise<LockState> {
    const course = await db
      .selectFrom("courses")
      .select(["unlocks_after_id", "unlocks_after_type"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", courseId)
      .executeTakeFirst();

    const requiresId = course?.unlocks_after_id;
    const requiresType = course?.unlocks_after_type;

    // No prerequisite, the overwhelmingly common case. Nothing to do, and we
    // skip the tenant lookup entirely.
    if (!requiresId || !requiresType) return { locked: false };

    // THE MASTER SWITCH. Off (the default for every tenant) means the feature
    // is not enforced: nothing is locked, and we say so before doing any of the
    // work below.
    //
    // Note what we do NOT do: clear the prerequisite. The chain stays exactly as
    // the admin built it, so switching back on restores it untouched. "Off"
    // means not enforced, never "silently still enforcing" (which would strand
    // locked learners with no UI to free them) and never "wipe the chains"
    // (which would make a misclick destroy real work).
    //
    // Read second, not first: a tenant with no gated courses at all never pays
    // for this query, and that is nearly every request.
    const sequencing = await this.sequencing(tenantId);
    if (!sequencing.on) return { locked: false };

    const adapter = ADAPTERS[String(requiresType)];
    if (!adapter) {
      // An offering type with no adapter cannot be evaluated, so it can never
      // be satisfied, and the course would be locked FOREVER. Fail OPEN: a
      // learner wrongly let in is a bad day; a learner permanently locked out of
      // a course they paid for is a refund and a support ticket.
      //
      // But fail open LOUDLY. A gate that quietly stops gating looks exactly
      // like a gate that's working, the admin sees the prerequisite saved on
      // screen and every learner walks straight through it. Nobody would ever
      // discover it, so say so.
      logger.warn(
        `[sequential-courses] No completion adapter for offering type "${requiresType}", course ${courseId} is NOT being gated. Learners can start it freely.`
      );
      return { locked: false };
    }

    // ── THE GRANDFATHER CLAUSE ──────────────────────────────────────────────
    // Anyone already partway through this course keeps it, no matter what.
    //
    // Without this, the day an admin sets their first prerequisite, EVERY
    // learner currently mid-way through the follow-on course is locked out.
    // because nothing ever recorded that they finished the first one. That's a
    // support ticket per learner, and it is entirely self-inflicted.
    //
    // Never take away access someone already had.
    if (await this.hasStarted(tenantId, memberId, courseId, sequencing.since)) {
      return { locked: false };
    }

    const status = await adapter.status(tenantId, memberId, requiresId);
    if (status.complete) {
      return { locked: false };
    }

    // Locked. Now find out what to TELL them, a bare "Locked" is useless.
    const blocker = await db
      .selectFrom("courses")
      .select(["id", "title", "slug"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", requiresId)
      .executeTakeFirst();

    // The prerequisite was deleted. Nothing left to finish, so nothing to wait
    // for, fail OPEN rather than lock a learner behind a course that no longer
    // exists. (The delete path clears these too, so this is belt-and-braces.
    // but a dangling pointer means one of them didn't run, which is worth
    // knowing about.)
    if (!blocker) {
      logger.warn(
        `[sequential-courses] Course ${courseId} requires ${requiresId}, which no longer exists, treating as unlocked.`
      );
      return { locked: false };
    }

    return {
      locked: true,
      blockedBy: {
        id: blocker.id,
        title: blocker.title,
        slug: blocker.slug,
        done: status.done,
        total: status.total,
      },
    };
  }

  /**
   * The tenant-wide master switch, and the moment it was switched on.
   *
   * `since` is what makes grandfathering honest, see hasStarted().
   */
  private async sequencing(
    tenantId: string
  ): Promise<{ on: boolean; since: Date | null }> {
    const t = await db
      .selectFrom("tenants")
      .select([
        "sequential_courses_enabled",
        "sequential_courses_enabled_at",
      ])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    return {
      on: Boolean(t?.sequential_courses_enabled),
      since: t?.sequential_courses_enabled_at ?? null,
    };
  }

  /**
   * Has this member made REAL progress in this course already?
   *
   * The grandfather test. It errs toward letting people in, but "real progress"
   * has to be earned, not merely recorded, and it has to look at the whole
   * course.
   *
   * ── Why not "any lecture-progress row exists?" ─────────────────────────────
   * Because a row is not evidence of progress. `recordHeartbeat` calls
   * `upsertProgress` on EVERY beat, including the zero-delta `isSessionStart`
   * beat the player fires when a video merely LOADS
   * (watch-session.service.ts:237). So a row appears before a single second is
   * watched. Treating that as "already started" turns the grandfather clause
   * into an unlock button: open the locked course once, get a row, stay
   * unlocked forever, and `check()` consults hasStarted BEFORE isComplete, so
   * the fast path would shadow the real test permanently.
   *
   * ── Why the time bound (enforcingSince) ──────────────────────────────────
   * Grandfathered means "was already under way when enforcement began": NOT
   * "has ever touched this course".
   *
   * While the master switch is OFF nothing is locked, so learners keep making
   * progress in courses that already have a prerequisite set. (That is the
   * normal flow: admins are meant to build the chain first and switch it on
   * afterwards.) Without a time bound, every one of those learners would carry a
   * permanent exemption the moment the switch was flipped, the feature would
   * turn on and gate almost nobody, and nothing on screen would explain why.
   *
   * So only progress made BEFORE `sequential_courses_enabled_at` counts. Work
   * done during the OFF window doesn't buy a lifetime pass.
   *
   * (The lock is also enforced in `ensureEnrolled`, so while the switch is ON a
   * locked learner can't mint a fresh row to let themselves in.)
   *
   * ── Why not lectures only? ─────────────────────────────────────────────────
   * Because a course can be made entirely of assignments and quizzes. That
   * learner has zero lecture-progress rows no matter how much work they've
   * done, so a lectures-only test would lock out precisely the person the
   * grandfather clause exists to protect. It's the same trap the certificate
   * already fell into once (see course-completion.service.ts), counting videos
   * and calling it the whole course.
   */
  private async hasStarted(
    tenantId: string,
    memberId: string,
    courseId: string,
    enforcingSince: Date | null
  ): Promise<boolean> {
    const [lecture, assignment, quiz] = await Promise.all([
      // A lecture counts as started only with watch time on the clock or an
      // outright completion, never on the bare row a page-load creates.
      db
        .selectFrom("member_lecture_progress")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("course_id", "=", courseId)
        .$if(!!enforcingSince, (qb) =>
          qb.where("created_at", "<", enforcingSince as Date)
        )
        .where((eb) =>
          eb.or([
            eb("completed", "=", true),
            // total_watch_seconds is a Postgres BIGINT, which Kysely types as
            // a string, comparing it to the number 0 is a type error, and
            // coercing it in JS would be the classic bigint bug. Compare as a
            // string literal and let Postgres do the numeric comparison.
            eb("total_watch_seconds", ">", "0"),
            eb("watched_duration", ">", 0),
          ])
        )
        .limit(1)
        .executeTakeFirst(),
      db
        .selectFrom("member_assignment_progress")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("course_id", "=", courseId)
        .$if(!!enforcingSince, (qb) =>
          qb.where("created_at", "<", enforcingSince as Date)
        )
        .limit(1)
        .executeTakeFirst(),
      db
        .selectFrom("member_quiz_progress")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("course_id", "=", courseId)
        .$if(!!enforcingSince, (qb) =>
          qb.where("created_at", "<", enforcingSince as Date)
        )
        .limit(1)
        .executeTakeFirst(),
    ]);

    return !!(lecture || assignment || quiz);
  }
}

export default new CourseUnlockService();
