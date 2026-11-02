import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { NotFoundError } from "../errors/not-found.error";
import type { offering_type } from "../db/enums";

/**
 * SEQUENTIAL COURSES, the admin side.
 *
 * A course can name ONE offering that must be finished before it opens:
 * A → B → C. `courses.unlocks_after_id` holds that link, and NULL (the default)
 * means "anyone can start me", so the feature is off for every tenant until an
 * admin sets it. Nothing changes for anyone who never uses it.
 *
 * SUCCESSORS ARE NEVER STORED. "What does this course unlock?" is
 * `WHERE unlocks_after_id = me`, one indexed read. Predecessor and successor
 * are the same fact seen from opposite ends; storing it twice is precisely how
 * the two ends come to disagree, and then something has to lose.
 *
 * The admin UI is free to present both directions as editable. Adding a
 * SUCCESSOR simply writes the OTHER course's row. One fact, two doors.
 */

export interface SequenceStep {
  id: string;
  title: string;
  slug: string;
  thumbnail_key: string | null;
  /** What this course waits for. NULL = it's the start of the chain. */
  unlocks_after_id: string | null;
  unlocks_after_type: offering_type | null;
}

export interface CourseSequence {
  /** The whole chain, in order, from the first course to the last. */
  steps: SequenceStep[];
}

class CourseSequenceService {
  // -------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------

  /**
   * The full chain a course belongs to, in order.
   *
   * Walks backwards to the head, then forwards to the tail, so the admin sees
   * the whole path, not just the one link they happen to be editing. That is
   * the difference between "set course 3's predecessor" and "look at the
   * journey I'm building", and it's the only way an admin can sanity-check it.
   */
  async getSequenceFor(
    tenantId: string,
    courseId: string
  ): Promise<CourseSequence> {
    const start = await this.load(tenantId, courseId);
    if (!start) throw new NotFoundError("Course not found");

    // Backwards to the head. The `seen` set is not paranoia: a cycle in the
    // data (from a bug, or a row written before this service existed) would
    // otherwise spin forever and take the request with it.
    const before: SequenceStep[] = [];
    const seen = new Set<string>([start.id]);
    let cur = start;
    while (cur.unlocks_after_id && cur.unlocks_after_type === "COURSE") {
      if (seen.has(cur.unlocks_after_id)) break; // cycle, stop, don't hang
      const prev = await this.load(tenantId, cur.unlocks_after_id);
      if (!prev) break; // dangling reference, treat as the head
      before.unshift(prev);
      seen.add(prev.id);
      cur = prev;
    }

    // Forwards to the tail. A course can unlock several others (that's fine.
    // it's a tree, not a strict line), but a *sequence* is one path, so we
    // follow the first successor and let the admin see the rest as branches.
    const after: SequenceStep[] = [];
    let node: SequenceStep | undefined = start;
    while (node) {
      const next: SequenceStep | undefined = await this.firstSuccessor(
        tenantId,
        node.id
      );
      if (!next || seen.has(next.id)) break;
      after.push(next);
      seen.add(next.id);
      node = next;
    }

    return { steps: [...before, start, ...after] };
  }

  /**
   * The tenant's whole ordered chain, head to tail.
   *
   * The model is a single linear sequence A → B → C, so there is exactly one
   * chain: start from any gated course and walk it to both ends. Returns [] when
   * nothing is sequenced yet.
   */
  async getChain(tenantId: string): Promise<SequenceStep[]> {
    // Any course that has a prerequisite, or is a prerequisite, is on the chain.
    const seed = await this.select()
      .where("tenant_id", "=", tenantId)
      .where("unlocks_after_id", "is not", null)
      .orderBy("sort_order", "asc")
      .executeTakeFirst() as unknown as SequenceStep | undefined;

    if (!seed) return [];
    const { steps } = await this.getSequenceFor(tenantId, seed.id);
    return steps;
  }

  /** Everything this course unlocks. Derived, never stored. */
  async getSuccessors(
    tenantId: string,
    courseId: string
  ): Promise<SequenceStep[]> {
    return this.select()
      .where("tenant_id", "=", tenantId)
      .where("unlocks_after_id", "=", courseId)
      .orderBy("sort_order", "asc")
      .execute() as unknown as Promise<SequenceStep[]>;
  }

  // -------------------------------------------------------------------------
  // The master switch
  // -------------------------------------------------------------------------

  /** Is sequencing enforced for this tenant, and may they turn it on? */
  async getSettings(tenantId: string): Promise<{
    enabled: boolean;
    enabled_at: Date | null;
    /** Courses that currently have a prerequisite, kept even while OFF. */
    chained_courses: number;
  }> {
    const t = await db
      .selectFrom("tenants")
      .select(["sequential_courses_enabled", "sequential_courses_enabled_at"])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    if (!t) throw new NotFoundError("Tenant not found");

    const chained = await db
      .selectFrom("courses")
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .where("tenant_id", "=", tenantId)
      .where("unlocks_after_id", "is not", null)
      .executeTakeFirst();

    return {
      enabled: t.sequential_courses_enabled,
      enabled_at: t.sequential_courses_enabled_at,
      chained_courses: Number(chained?.n ?? 0),
    };
  }

  /**
   * Flip the master switch.
   *
   * Turning it OFF does NOT clear anybody's prerequisites. The chain is left
   * exactly as the admin built it and simply stops being enforced, so switching
   * back on restores it untouched.
   *
   * That is the whole contract: OFF = not enforced, nothing lost. It must never
   * mean "still enforcing but the UI is hidden" (locked learners, no way to free
   * them) and never "delete the chains" (a misclick destroys real work).
   */
  async updateSettings(
    tenantId: string,
    enabled: boolean,
    updatedByUserId: string
  ): Promise<{ enabled: boolean; enabled_at: Date | null; chained_courses: number }> {
    // Sequential courses is available to EVERY tenant, no entitlement gate.
    // The master switch (this flag) is the only control; a tenant admin turns it
    // on or off for themselves.
    const current = await this.getSettings(tenantId);
    if (current.enabled === enabled) return current;

    await db
      .updateTable("tenants")
      .set({
        sequential_courses_enabled: enabled,
        // Keep who/when even when switching OFF. The boolean already says it's
        // off; nulling these throws away the audit trail these columns exist
        // for ("who turned this on, and when?") the first time anyone toggles.
        ...(enabled
          ? {
              sequential_courses_enabled_at: new Date(),
              sequential_courses_enabled_by_user_id: updatedByUserId,
            }
          : {}),
        updated_at: new Date(),
      })
      .where("id", "=", tenantId)
      .execute();

    return this.getSettings(tenantId);
  }

  // -------------------------------------------------------------------------
  // Writing
  // -------------------------------------------------------------------------

  /**
   * Set (or clear) what a course waits for.
   *
   * `requiresId = null` clears the prerequisite for THIS course.
   *
   * Two different switches, and they do different jobs:
   *   - the tenant-wide MASTER SWITCH (getSettings/updateSettings above) decides
   *     whether sequencing is enforced at all;
   *   - the prerequisite decides what this one course waits for.
   *
   * Clearing a prerequisite is permanent (the link is gone). Turning the master
   * switch off is not (every link is kept, just not enforced). Setting a
   * prerequisite while the master switch is OFF is allowed on purpose: build the
   * chain, review it, then switch enforcement on.
   */
  async setPrerequisite(
    tenantId: string,
    courseId: string,
    requires: { id: string; type: offering_type } | null
  ): Promise<void> {
    const course = await this.load(tenantId, courseId);
    if (!course) throw new NotFoundError("Course not found");

    if (requires) {
      if (requires.id === courseId) {
        throw new BadRequestError(
          "A course can't require itself, nobody would ever be able to start it."
        );
      }

      // Only COURSE is wired up. BOOK and TEST_SERIES exist in the enum so the
      // column never has to change, but each needs a completion adapter before
      // it can gate anything, and a test series needs a pass-mark policy
      // decided first. Refuse loudly rather than silently never unlock.
      if (requires.type !== "COURSE") {
        throw new BadRequestError(
          `${requires.type} prerequisites aren't supported yet, only courses.`
        );
      }

      const target = await this.load(tenantId, requires.id);
      if (!target) {
        throw new NotFoundError("The course you picked doesn't exist");
      }

      await this.assertNoCycle(tenantId, courseId, requires.id);
    }

    await db
      .updateTable("courses")
      .set({
        unlocks_after_id: requires?.id ?? null,
        unlocks_after_type: requires?.type ?? null,
        updated_at: new Date(),
      })
      .where("id", "=", courseId)
      .where("tenant_id", "=", tenantId)
      .execute();
  }

  /**
   * Rebuild a whole chain from an ordered list of course ids.
   *
   * This is what the Sequences screen saves: the admin drags courses into
   * order, and we rewrite the links so each one waits for the one above it. The
   * first course in the list has no prerequisite.
   *
   * Runs in a transaction, a half-written chain would leave courses pointing at
   * the wrong predecessor, which locks real learners out of the wrong things.
   */
  async saveSequence(tenantId: string, courseIds: string[]): Promise<void> {
    const unique = new Set(courseIds);
    if (unique.size !== courseIds.length) {
      throw new BadRequestError(
        "A course can only appear once in a sequence."
      );
    }

    // Every id must be a real course of THIS tenant. Checked in one query
    // rather than N, and it doubles as the tenant-scoping guard.
    if (courseIds.length > 0) {
      const found = await db
        .selectFrom("courses")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("id", "in", courseIds)
        .execute();

      if (found.length !== courseIds.length) {
        throw new NotFoundError("One of those courses doesn't exist");
      }
    }

    const now = new Date();

    await db.transaction().execute(async (trx) => {
      // First, RELEASE anything that was in this chain but has been dropped
      // from the new order.
      //
      // Without this, removing a course from the middle of a sequence leaves it
      // pointing at its old predecessor. It stays locked, but it no longer
      // appears on the Sequences screen, so no admin can see the link, let alone
      // clear it. The course becomes silently unreachable for every learner who
      // hasn't already started it, and nothing in the UI explains why.
      //
      // Dropping a course from the chain means "this course is no longer gated",
      // so that is what we write.
      //
      // With courses in the list, a course counts as "dropped" if it points at
      // one of the reordered courses but isn't itself in the new order.
      //
      // With an EMPTY list, the admin is clearing the whole sequence, so EVERY
      // gated course in the tenant is dropped. (The earlier version short-
      // circuited empty to [] and released nothing, a save-empty silently did
      // nothing, so a chain could never be cleared from the builder.)
      const dropped =
        courseIds.length === 0
          ? await trx
              .selectFrom("courses")
              .select("id")
              .where("tenant_id", "=", tenantId)
              .where("unlocks_after_id", "is not", null)
              .execute()
          : await trx
              .selectFrom("courses")
              .select("id")
              .where("tenant_id", "=", tenantId)
              .where("unlocks_after_id", "in", courseIds)
              .where("id", "not in", courseIds)
              .execute();

      if (dropped.length > 0) {
        await trx
          .updateTable("courses")
          .set({
            unlocks_after_id: null,
            unlocks_after_type: null,
            updated_at: now,
          })
          .where("tenant_id", "=", tenantId)
          .where(
            "id",
            "in",
            dropped.map((d) => d.id)
          )
          .execute();
      }

      for (let i = 0; i < courseIds.length; i++) {
        const previous = i === 0 ? null : courseIds[i - 1];
        await trx
          .updateTable("courses")
          .set({
            unlocks_after_id: previous,
            unlocks_after_type: previous ? "COURSE" : null,
            updated_at: now,
          })
          .where("id", "=", courseIds[i])
          .where("tenant_id", "=", tenantId)
          .execute();
      }
    });
  }

  // -------------------------------------------------------------------------
  // The guard that matters
  // -------------------------------------------------------------------------

  /**
   * Refuse to create a loop.
   *
   * A → B → A locks a learner out of BOTH courses, permanently: neither can ever
   * be started, because each is waiting for the other. There is no recovery from
   * the learner's side and no error to see, the courses simply never open.
   *
   * So we catch it HERE, at save time, while an admin is looking at the screen
   * and can fix it. Discovering it at read time means someone is already stuck.
   *
   * The check: walk the chain UP from the proposed prerequisite. If we ever
   * arrive at the course we're editing, this link would close a loop.
   */
  private async assertNoCycle(
    tenantId: string,
    courseId: string,
    prerequisiteId: string
  ): Promise<void> {
    const seen = new Set<string>([courseId]);
    let cursor: string | null = prerequisiteId;
    const path: string[] = [];

    while (cursor) {
      if (seen.has(cursor)) {
        // We came back to a course already on the path, a loop.
        const chain = await this.titlesFor(tenantId, [courseId, ...path]);
        throw new ConflictError(
          chain.length > 1
            ? `That would create a loop: ${chain.join(" → ")} → ${chain[0]}. ` +
              `Nobody could ever start any of them.`
            : "That would create a loop, nobody could ever start either course."
        );
      }
      seen.add(cursor);
      path.push(cursor);

      const node = await this.load(tenantId, cursor);
      if (!node) break; // dangling, the chain ends here
      cursor =
        node.unlocks_after_type === "COURSE" ? node.unlocks_after_id : null;
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private select() {
    return db
      .selectFrom("courses")
      .select([
        "id",
        "title",
        "slug",
        "thumbnail_key",
        "sort_order",
        "unlocks_after_id",
        "unlocks_after_type",
      ]);
  }

  private async load(
    tenantId: string,
    courseId: string
  ): Promise<SequenceStep | undefined> {
    return this.select()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", courseId)
      .executeTakeFirst() as unknown as Promise<SequenceStep | undefined>;
  }

  private async firstSuccessor(
    tenantId: string,
    courseId: string
  ): Promise<SequenceStep | undefined> {
    return this.select()
      .where("tenant_id", "=", tenantId)
      .where("unlocks_after_id", "=", courseId)
      .orderBy("sort_order", "asc")
      .executeTakeFirst() as unknown as Promise<SequenceStep | undefined>;
  }

  /** Course titles, so the cycle error can name the loop instead of listing ids. */
  private async titlesFor(
    tenantId: string,
    ids: string[]
  ): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await db
      .selectFrom("courses")
      .select(["id", "title"])
      .where("tenant_id", "=", tenantId)
      .where("id", "in", ids)
      .execute();

    const byId = new Map(rows.map((r) => [r.id, r.title]));
    return ids.map((id) => byId.get(id) ?? "a course");
  }
}

export default new CourseSequenceService();
