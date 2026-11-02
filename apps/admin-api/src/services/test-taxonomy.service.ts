import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import testTaxonomyRepository, {
  type TaxonomyNodeRow,
} from "../repositories/test-taxonomy.repository";
import testQuestionsRepository from "../repositories/test-questions.repository";

const KINDS = ["SUBJECT", "CHAPTER", "TOPIC"] as const;

export interface TaxonomyNodeDTO {
  id: string;
  tenantId: string;
  kind: string;
  parentId: string | null;
  name: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

function toNode(row: TaxonomyNodeRow): TaxonomyNodeDTO {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    kind: String(row.kind),
    parentId: row.parent_id,
    name: row.name,
    orderIndex: Number(row.order_index ?? 0),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

/**
 * One rule of a per-section question distribution blueprint: pick `value`
 * questions (COUNT) or `value`% of the section total (PERCENT) matching the
 * taxonomy filter + optional difficulty.
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

export function resolveRuleCount(rule: BlueprintRule, totalCount?: number): number {
  if (rule.mode === "PERCENT")
    return Math.round(((rule.value ?? 0) / 100) * (totalCount ?? 0));
  return Math.max(0, Math.floor(rule.value ?? 0));
}

class TestTaxonomyService {
  async list(tenantId: string, kind?: string, parentId?: string | null) {
    const rows = await testTaxonomyRepository.findByTenant(tenantId, {
      kind: kind ? String(kind).toUpperCase() : undefined,
      parent_id: parentId,
    });
    return rows.map(toNode);
  }

  async create(
    tenantId: string,
    data: { kind: string; name: string; parentId?: string | null; orderIndex?: number }
  ) {
    if (!data.name?.trim()) throw new BadRequestError("Name is required");
    const kind = String(data.kind ?? "").toUpperCase();
    if (!KINDS.includes(kind as (typeof KINDS)[number]))
      throw new BadRequestError("kind must be SUBJECT, CHAPTER or TOPIC");
    if ((kind === "CHAPTER" || kind === "TOPIC") && !data.parentId)
      throw new BadRequestError(`A ${kind.toLowerCase()} requires a parent`);
    if (data.parentId) {
      const parent = await testTaxonomyRepository.findById(data.parentId, tenantId);
      if (!parent) throw new BadRequestError("Parent taxonomy item not found");
    }
    const row = await testTaxonomyRepository.create({
      tenant_id: tenantId,
      kind,
      name: data.name.trim(),
      parent_id: data.parentId ?? null,
      order_index: data.orderIndex,
    });
    return toNode(row);
  }

  async update(
    tenantId: string,
    id: string,
    data: { name?: string; parentId?: string | null; orderIndex?: number }
  ) {
    const existing = await testTaxonomyRepository.findById(id, tenantId);
    if (!existing) throw new NotFoundError("Taxonomy item not found");
    const row = await testTaxonomyRepository.update(id, tenantId, {
      name: data.name?.trim(),
      parent_id: data.parentId,
      order_index: data.orderIndex,
    });
    return row ? toNode(row) : null;
  }

  async remove(tenantId: string, id: string) {
    const ok = await testTaxonomyRepository.delete(id, tenantId);
    if (!ok) throw new NotFoundError("Taxonomy item not found");
    return { deleted: true };
  }

  /**
   * One-click migration: build the fixed taxonomy from questions' existing
   * free-text subject/chapter/topic and link every question to the matching
   * nodes. Idempotent, re-running only fills gaps.
   */
  async importFromTags(tenantId: string) {
    const distinct = await testQuestionsRepository.findDistinctTags(tenantId);
    const existing = await testTaxonomyRepository.findByTenant(tenantId);
    const nodeByKey = new Map<string, { id: string }>();
    for (const n of existing) {
      nodeByKey.set(`${n.kind}|${n.parent_id ?? ""}|${n.name}`, { id: n.id });
    }

    const created = { subjects: 0, chapters: 0, topics: 0 };
    const ensureNode = async (
      kind: string,
      name: string,
      parentId: string | null
    ): Promise<{ id: string }> => {
      const key = `${kind}|${parentId ?? ""}|${name}`;
      const found = nodeByKey.get(key);
      if (found) return found;
      const row = await testTaxonomyRepository.create({
        tenant_id: tenantId,
        kind,
        name,
        parent_id: parentId,
      });
      nodeByKey.set(key, { id: row.id });
      if (kind === "SUBJECT") created.subjects += 1;
      else if (kind === "CHAPTER") created.chapters += 1;
      else created.topics += 1;
      return { id: row.id };
    };

    let questionsTagged = 0;
    for (const d of distinct) {
      const subjectName = (d.subject ?? "").trim();
      if (!subjectName) continue;
      const subjectNode = await ensureNode("SUBJECT", subjectName, null);

      const chapterName = (d.chapter ?? "").trim();
      const chapterNode = chapterName
        ? await ensureNode("CHAPTER", chapterName, subjectNode.id)
        : null;

      const topicName = (d.topic ?? "").trim();
      const topicNode =
        topicName && chapterNode
          ? await ensureNode("TOPIC", topicName, chapterNode.id)
          : null;

      questionsTagged += await testQuestionsRepository.setNodeIdsByTags(
        tenantId,
        { subject: d.subject as string, chapter: d.chapter, topic: d.topic },
        {
          subject_node_id: subjectNode.id,
          chapter_node_id: chapterNode?.id ?? null,
          topic_node_id: topicNode?.id ?? null,
        }
      );
    }

    return { ...created, questionsTagged };
  }

  /**
   * For each blueprint rule, count how many bank questions match. Powers the
   * "Only X questions available" authoring prompt.
   */
  async checkAvailability(
    tenantId: string,
    input: { questionBankId: string; totalCount?: number; rules: BlueprintRule[] }
  ) {
    if (!input.questionBankId)
      throw new BadRequestError("questionBankId is required");
    const rules = Array.isArray(input.rules) ? input.rules : [];
    const results = await Promise.all(
      rules.map(async (r) => {
        const requested = resolveRuleCount(r, input.totalCount);
        const available = await testQuestionsRepository.countAvailable(tenantId, {
          question_bank_id: input.questionBankId,
          subject_node_id: r.subjectNodeId ?? undefined,
          chapter_node_id: r.chapterNodeId ?? undefined,
          topic_node_id: r.topicNodeId ?? undefined,
          difficulty: r.difficulty && r.difficulty !== "ANY" ? r.difficulty : undefined,
        });
        return {
          ruleId: r.id ?? null,
          requested,
          available,
          short: Math.max(0, requested - available),
        };
      })
    );
    return { rules: results, ok: results.every((x) => x.short === 0) };
  }
}

export default new TestTaxonomyService();
