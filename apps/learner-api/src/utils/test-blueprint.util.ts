/**
 * Per-section question distribution blueprint selection.
 *
 * A section's `question_selection` JSON can define rules like "pick 5 HARD
 * questions from Chapter A" (COUNT) or "30% of the section from Topic X"
 * (PERCENT). This resolves the rules against the section's question pool and
 * returns the concrete question ids to serve for one attempt. The actual
 * pick uses the caller's least-served picker, so every attempt gets a
 * different set while keeping the same per-rule counts.
 */

export interface BlueprintRule {
  id?: string;
  subjectNodeId?: string | null;
  chapterNodeId?: string | null;
  topicNodeId?: string | null;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "ANY";
  mode?: "COUNT" | "PERCENT";
  value?: number;
}

export interface SectionBlueprint {
  mode?: string;
  totalCount?: number;
  rules?: BlueprintRule[];
}

interface QuestionLite {
  id: string;
  subject_node_id: string | null;
  chapter_node_id: string | null;
  topic_node_id: string | null;
  difficulty: string;
}

interface SectionQuestionLite {
  section_id: string;
  question_id: string;
}

interface SectionLite {
  id: string;
  question_selection: unknown;
  random_question_count?: number | null;
}

function parseBlueprint(raw: unknown): SectionBlueprint | null {
  if (!raw) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  return obj as SectionBlueprint;
}

export function resolveRuleCount(rule: BlueprintRule, totalCount?: number): number {
  if (rule.mode === "PERCENT")
    return Math.round(((rule.value ?? 0) / 100) * (totalCount ?? 0));
  return Math.max(0, Math.floor(rule.value ?? 0));
}

function matchesRule(q: QuestionLite, rule: BlueprintRule): boolean {
  if (rule.subjectNodeId && q.subject_node_id !== rule.subjectNodeId) return false;
  if (rule.chapterNodeId && q.chapter_node_id !== rule.chapterNodeId) return false;
  if (rule.topicNodeId && q.topic_node_id !== rule.topicNodeId) return false;
  if (rule.difficulty && rule.difficulty !== "ANY" && q.difficulty !== rule.difficulty)
    return false;
  return true;
}

/**
 * Returns the served question ids honouring each section's configuration, or
 * `null` when no section is configured (so the caller falls back to the legacy
 * test-level random_question_count / whole-pool behaviour).
 *
 * Per section, in priority order:
 *  - blueprint rules → pick each rule's count from the section pool matching
 *    that rule (subject/chapter/topic/difficulty), different every attempt;
 *  - a section random_question_count → pick that many at random from the pool;
 *  - otherwise → serve the whole section pool.
 */
export async function selectBlueprintQuestions(
  sections: SectionLite[],
  sectionQuestions: SectionQuestionLite[],
  questions: QuestionLite[],
  pick: (poolIds: string[], count: number) => Promise<string[]>
): Promise<string[] | null> {
  const qById = new Map(questions.map((q) => [q.id, q]));
  const poolBySection = new Map<string, string[]>();
  for (const sq of sectionQuestions) {
    const arr = poolBySection.get(sq.section_id) ?? [];
    arr.push(sq.question_id);
    poolBySection.set(sq.section_id, arr);
  }

  let anyConfig = false;
  const chosen = new Set<string>();
  const selected: string[] = [];

  const add = (ids: string[]) => {
    for (const id of ids) {
      if (!chosen.has(id)) {
        chosen.add(id);
        selected.push(id);
      }
    }
  };

  for (const section of sections) {
    const poolIds = poolBySection.get(section.id) ?? [];
    const bp = parseBlueprint(section.question_selection);
    const rules =
      bp && Array.isArray(bp.rules) ? bp.rules.filter((r) => r) : [];
    const randomCount = Number(section.random_question_count ?? 0);

    if (rules.length > 0) {
      anyConfig = true;
      const pool = poolIds
        .map((id) => qById.get(id))
        .filter((q): q is QuestionLite => Boolean(q));
      for (const rule of rules) {
        const need = resolveRuleCount(rule, bp?.totalCount);
        if (need <= 0) continue;
        const matching = pool
          .filter((q) => !chosen.has(q.id) && matchesRule(q, rule))
          .map((q) => q.id);
        if (matching.length === 0) continue;
        add(await pick(matching, Math.min(need, matching.length)));
      }
    } else if (Number.isInteger(randomCount) && randomCount > 0) {
      anyConfig = true;
      const avail = poolIds.filter((id) => !chosen.has(id));
      add(await pick(avail, Math.min(randomCount, avail.length)));
    } else {
      // No per-section config: serve the whole section pool.
      add(poolIds);
    }
  }

  if (!anyConfig) return null;
  return selected;
}
