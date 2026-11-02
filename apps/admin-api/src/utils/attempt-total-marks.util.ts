import { sql, type RawBuilder } from "kysely";

/**
 * SQL for one attempt's total marks, the denominator behind
 * `test_attempts.percentage`.
 *
 * A test can serve a different question set to every learner (a test-level
 * `random_question_count`, or a per-section blueprint in
 * `test_sections.question_selection`), and each attempt freezes the subset it
 * was served in `test_attempts.question_ids`. Marks are per question, so two
 * learners sitting the same test can be graded out of different totals. The
 * same raw score then yields two different percentages, correct, but it reads
 * as a bug wherever the denominator is not shown alongside it.
 *
 * Resolution order:
 *
 *  1. `test_attempts.total_marks`, recorded at submit. Authoritative.
 *  2. …otherwise reconstruct it the way learner-api grades, for attempts that
 *     predate that column:
 *       a. standard attempt with a frozen subset → sum of that subset's marks,
 *          where a section `marks_override` wins over the question's own marks
 *       b. adaptive attempt → sum over the scored questions of its served
 *          modules (adaptive keeps no `test_section_questions` rows)
 *       c. whole pool served (empty `question_ids`) → the test's stored
 *          `total_marks`
 *
 * A question attached to two sections of the same test is counted once, matching
 * the map learner-api builds while grading.
 *
 * The reconstruction is only exact while the test is unchanged: branch (c) reads
 * a figure that moves whenever questions are added, removed or repriced. Callers
 * must therefore still reconcile the result against the stored percentage before
 * showing it (see `displayTotalMarks`). That caveat does not apply to branch 1,
 * which is why the column exists.
 *
 * @param attempt alias the calling query gave `test_attempts`
 * @param test    alias the calling query gave `tests`
 */
export function attemptTotalMarksSql(
  attempt = "a",
  test = "t"
): RawBuilder<string | null> {
  const a = sql.table(attempt);
  const t = sql.table(test);
  return sql<string | null>`coalesce(
    -- Recorded at submit. Authoritative, and the only branch that stays correct
    -- when the test's questions change afterwards. Null on attempts predating
    -- the column, which fall through to the reconstruction below.
    ${a}.total_marks,
    (
      select sum(served.marks)
      from (
        select distinct on (sq.question_id)
               coalesce(sq.marks_override, q.marks) as marks
        from test_section_questions sq
        join test_questions q on q.id = sq.question_id
        where sq.tenant_id = ${a}.tenant_id
          and sq.test_id = ${a}.test_id
          and sq.question_id = any(${a}.question_ids)
        order by sq.question_id
      ) served
    ),
    (
      select sum(q.marks)
      from test_attempt_modules am
      join lateral unnest(am.question_ids) as served(question_id) on true
      join test_questions q on q.id = served.question_id
      where am.tenant_id = ${a}.tenant_id
        and am.attempt_id = ${a}.id
    ),
    ${t}.total_marks
  )`;
}
