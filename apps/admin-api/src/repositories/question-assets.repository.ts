import { ulid } from "ulid";
import { db } from "../db/connection";

/**
 * Reusable uploaded question files ("Asset Library"). A parsed CSV is stored
 * once and can be re-imported into any quiz/bank without re-uploading.
 */
export async function createAsset(input: {
  tenant_id: string;
  name: string;
  questions: unknown;
  question_count: number;
  created_by?: string | null;
}): Promise<string> {
  const id = ulid();
  const now = new Date();
  await db
    .insertInto("question_upload_assets")
    .values({
      id,
      tenant_id: input.tenant_id,
      name: input.name,
      // jsonb column, store as a JSON string (never double-serialize).
      questions: JSON.stringify(input.questions),
      question_count: input.question_count,
      created_by: input.created_by ?? null,
      created_at: now,
      updated_at: now,
    })
    .execute();
  return id;
}

export async function listAssets(
  tenantId: string
): Promise<
  Array<{ id: string; name: string; question_count: number; created_at: Date }>
> {
  const rows = await db
    .selectFrom("question_upload_assets")
    .select(["id", "name", "question_count", "created_at"])
    .where("tenant_id", "=", tenantId)
    .orderBy("created_at", "desc")
    .execute();
  return rows as unknown as Array<{
    id: string;
    name: string;
    question_count: number;
    created_at: Date;
  }>;
}

export async function getAsset(
  tenantId: string,
  assetId: string
): Promise<{ questions: unknown } | null> {
  const row = await db
    .selectFrom("question_upload_assets")
    .select("questions")
    .where("tenant_id", "=", tenantId)
    .where("id", "=", assetId)
    .executeTakeFirst();
  return row ? { questions: row.questions } : null;
}

export async function deleteAsset(
  tenantId: string,
  assetId: string
): Promise<boolean> {
  const res = await db
    .deleteFrom("question_upload_assets")
    .where("tenant_id", "=", tenantId)
    .where("id", "=", assetId)
    .executeTakeFirst();
  return Number(res?.numDeletedRows ?? 0) > 0;
}
