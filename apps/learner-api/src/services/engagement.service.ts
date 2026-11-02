import engagementRepository, {
  type LeaderEntry,
} from "../repositories/engagement.repository";

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface RankedEntry extends LeaderEntry {
  rank: number;
}

class EngagementService {
  private rankAndSlice(
    full: LeaderEntry[],
    learnerId: string,
    limit: number
  ): {
    entries: RankedEntry[];
    me: RankedEntry | null;
    totalRanked: number;
  } {
    const ranked: RankedEntry[] = full.map((e, i) => ({ ...e, rank: i + 1 }));
    const me = ranked.find((e) => e.learnerId === learnerId) ?? null;
    return { entries: ranked.slice(0, limit), me, totalRanked: ranked.length };
  }

  async getTestLeaderboard(
    tenantId: string,
    testId: string,
    learnerId: string,
    limit: number
  ) {
    const full = await engagementRepository.testLeaderboard(tenantId, testId);
    return { metric: "best_score", ...this.rankAndSlice(full, learnerId, limit) };
  }

  /**
   * Daily activity streak derived from test-attempt dates (no stored counter.
   * always accurate). Current streak counts consecutive UTC days ending today
   * or yesterday; longest is the longest consecutive run ever.
   */
  async getStreak(tenantId: string, learnerId: string) {
    const dates = await engagementRepository.learnerActivityDates(
      tenantId,
      learnerId
    );
    const set = new Set(dates);
    const today = todayKey();
    const yesterday = addDays(today, -1);

    let current = 0;
    let cursor = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
    while (cursor && set.has(cursor)) {
      current += 1;
      cursor = addDays(cursor, -1);
    }

    let longest = 0;
    let run = 0;
    let prev: string | null = null;
    for (const d of dates) {
      run = prev && d === addDays(prev, 1) ? run + 1 : 1;
      if (run > longest) longest = run;
      prev = d;
    }

    // 30-day activity calendar (oldest → today).
    const calendar: Array<{ date: string; active: boolean }> = [];
    for (let i = 29; i >= 0; i--) {
      const day = addDays(today, -i);
      calendar.push({ date: day, active: set.has(day) });
    }

    return {
      currentStreak: current,
      longestStreak: longest,
      totalActiveDays: dates.length,
      lastActiveDate: dates.length ? dates[dates.length - 1] : null,
      activeToday: set.has(today),
      calendar,
    };
  }
}

export default new EngagementService();
