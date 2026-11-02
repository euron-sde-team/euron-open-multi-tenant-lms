import { sql, type RawBuilder } from "kysely";

/**
 * Rank and percentile for one attempt, measured against the test's CURRENT cohort.
 *
 * `test_attempts.rank` and `.percentile` are written once at submit, against
 * whoever happened to have finished by that moment, and never revisited. The
 * cohort then grows underneath them: an early submitter is ranked among a
 * handful of peers, a late one among everybody. Two learners with the SAME
 * score on the SAME test therefore end up with different percentiles, and a
 * zero score can show as rank 1 purely for having been submitted first.
 *
 * Recomputing on read fixes that by construction: equal scores can only produce
 * equal numbers. The stored columns are left alone as the at-submit snapshot.
 *
 * Cohort: submitted attempts on the same test that carry a score. The
 * definitions match what learner-api writes at submit, so values stay
 * comparable with what learners have already seen:
 *  - rank       1 + however many scored strictly higher, so ties share a rank
 *  - percentile the share of the cohort scoring strictly lower, as a percentage
 *
 * Both are null for an attempt with no score yet (still in progress).
 * Backed by the `(tenant_id, test_id, score)` index on test_attempts.
 *
 * @param attempt alias the calling query gave `test_attempts`
 */
function cohortFilter(a: RawBuilder<unknown>) {
  return sql`c.tenant_id = ${a}.tenant_id
    and c.test_id = ${a}.test_id
    and c.status in ('SUBMITTED', 'AUTO_SUBMITTED')
    and c.score is not null`;
}

/** Share of the current cohort scoring strictly lower, 0..100, 2dp. */
export function attemptPercentileSql(attempt = "a"): RawBuilder<string | null> {
  const a = sql.table(attempt);
  return sql<string | null>`case when ${a}.score is null then null else (
    select round(
      (count(*) filter (where c.score < ${a}.score))::numeric * 100
        / nullif(count(*), 0),
      2)
    from test_attempts c
    where ${cohortFilter(a)}
  ) end`;
}

/** 1 + the number of current cohort attempts scoring strictly higher. Ties share a rank. */
export function attemptRankSql(attempt = "a"): RawBuilder<number | null> {
  const a = sql.table(attempt);
  return sql<number | null>`case when ${a}.score is null then null else (
    select count(*) + 1
    from test_attempts c
    where ${cohortFilter(a)}
      and c.score > ${a}.score
  ) end`;
}
