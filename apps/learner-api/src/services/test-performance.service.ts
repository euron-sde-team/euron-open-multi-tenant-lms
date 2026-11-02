import { BadRequestError } from "../errors/bad-request.error";
import testPerformanceRepository, {
  type PerfFactRow,
} from "../repositories/test-performance.repository";

interface Bucket {
  label: string;
  subject?: string | null;
  total: number;
  correct: number;
  accuracy: number;
}

/** Minimum answered questions before a skill counts toward strength/weakness. */
const MIN_SKILL_ATTEMPTS = 3;

function pct(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 1000) / 10;
}

function mergeFacts(...lists: PerfFactRow[][]): PerfFactRow[] {
  const map = new Map<string, PerfFactRow>();
  for (const list of lists) {
    for (const f of list) {
      const key = `${f.subject}|${f.chapter}|${f.topic}|${f.difficulty}|${f.type}`;
      const prev = map.get(key);
      if (prev) {
        prev.total += f.total;
        prev.correct += f.correct;
      } else {
        map.set(key, { ...f });
      }
    }
  }
  return [...map.values()];
}

function rollup(
  facts: PerfFactRow[],
  keyOf: (f: PerfFactRow) => string | null,
  labelOf: (f: PerfFactRow) => string
): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const f of facts) {
    const key = keyOf(f);
    if (key === null) continue;
    const b = map.get(key) ?? {
      label: labelOf(f),
      subject: f.subject,
      total: 0,
      correct: 0,
      accuracy: 0,
    };
    b.total += f.total;
    b.correct += f.correct;
    map.set(key, b);
  }
  return [...map.values()]
    .map((b) => ({ ...b, accuracy: pct(b.correct, b.total) }))
    .sort((a, b) => b.total - a.total);
}

class TestPerformanceService {
  async getDashboard(tenantId: string, learnerId: string) {
    const [attempt, recent] = await Promise.all([
      testPerformanceRepository.attemptFacts(tenantId, learnerId),
      testPerformanceRepository.recentActivity(tenantId, learnerId, 15),
    ]);
    const facts = mergeFacts(attempt);

    const totalAnswered = facts.reduce((s, f) => s + f.total, 0);
    const totalCorrect = facts.reduce((s, f) => s + f.correct, 0);

    const bySubject = rollup(
      facts,
      (f) => f.subject,
      (f) => f.subject ?? "Unspecified"
    );
    const byDomain = rollup(
      facts,
      (f) => (f.chapter ? `${f.subject}|${f.chapter}` : null),
      (f) => f.chapter ?? "Unspecified"
    );
    const bySkill = rollup(
      facts,
      (f) => (f.topic ? `${f.subject}|${f.chapter}|${f.topic}` : null),
      (f) => f.topic ?? "Unspecified"
    );
    const byDifficulty = rollup(
      facts,
      (f) => f.difficulty,
      (f) => f.difficulty
    );
    const byType = rollup(
      facts,
      (f) => f.type,
      (f) => f.type
    );

    const ranked = bySkill.filter((s) => s.total >= MIN_SKILL_ATTEMPTS);
    const strengths = [...ranked]
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5);
    const weaknesses = [...ranked]
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    const recommendations: string[] = [];
    for (const w of weaknesses.slice(0, 3)) {
      if (w.accuracy < 70)
        recommendations.push(
          `Practice "${w.label}", ${w.accuracy}% accuracy over ${w.total} questions.`
        );
    }
    if (totalAnswered === 0)
      recommendations.push(
        "Take a test to start building your performance profile."
      );

    return {
      overall: {
        questionsAnswered: totalAnswered,
        correct: totalCorrect,
        accuracy: pct(totalCorrect, totalAnswered),
      },
      bySubject,
      byDomain,
      bySkill,
      byDifficulty,
      byType,
      strengths,
      weaknesses,
      recommendations,
      recentActivity: recent,
    };
  }

  /**
   * Standalone Digital-SAT raw→scaled estimator. Each section maps raw% onto
   * 200-800 (snapped to the nearest 10). This is an ESTIMATE, the official
   * curve varies per form; an admin norm/scale table on a real test overrides
   * this at grading time. Two SAT sections give a 400-1600 total.
   */
  calculateScore(input: {
    sections?: Array<{ name?: string; rawCorrect?: number; totalQuestions?: number }>;
  }): {
    sections: Array<{ name: string; rawCorrect: number; totalQuestions: number; scaled: number }>;
    total: number;
    maxTotal: number;
    estimate: true;
  } {
    const sections = Array.isArray(input.sections) ? input.sections : [];
    if (sections.length === 0) {
      throw new BadRequestError(
        "At least one section { name, rawCorrect, totalQuestions } is required"
      );
    }
    const out = sections.map((s, i) => {
      const total = Math.max(0, Number(s.totalQuestions) || 0);
      const raw = Math.max(0, Math.min(total, Number(s.rawCorrect) || 0));
      const ratio = total === 0 ? 0 : raw / total;
      const scaled = Math.max(
        200,
        Math.min(800, Math.round((200 + ratio * 600) / 10) * 10)
      );
      return {
        name: s.name?.trim() || `Section ${i + 1}`,
        rawCorrect: raw,
        totalQuestions: total,
        scaled,
      };
    });
    return {
      sections: out,
      total: out.reduce((sum, s) => sum + s.scaled, 0),
      maxTotal: out.length * 800,
      estimate: true,
    };
  }
}

export default new TestPerformanceService();
