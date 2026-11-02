import { ulid } from "ulid";
import { db } from "../db/connection";

/** Strip the U+0000 null byte, which PostgreSQL's JSON parser rejects, so an
 *  admin pasting one into a designer element does not 500 the save. Mirrors the
 *  serializeJson helper in the tests / test-modules repos. */
function serializeJson(value: unknown): string {
  return JSON.stringify(value).replace(/\\u0000/g, "");
}

export interface CertificateTemplateInput {
  name: string;
  page_size?: string;
  orientation?: string;
  background_asset_url?: string | null;
  layout: unknown;
  is_default?: boolean;
  status?: string;
}

/** Update never touches is_default, setDefault() is the sole writer of the
 *  one-default-per-tenant invariant. Omitting it here closes the trap where a
 *  caller passes is_default expecting update() to honor it. */
export type CertificateTemplateUpdate = Partial<
  Omit<CertificateTemplateInput, "is_default">
>;

class CertificateDesignerRepository {
  async listByTenant(tenantId: string) {
    return db
      .selectFrom("certificate_templates")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .orderBy("created_at", "desc")
      .execute();
  }

  async findById(tenantId: string, id: string) {
    return db
      .selectFrom("certificate_templates")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async findDefault(tenantId: string) {
    return db
      .selectFrom("certificate_templates")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("is_default", "=", true)
      .executeTakeFirst();
  }

  async create(tenantId: string, data: CertificateTemplateInput) {
    const id = ulid();
    await db
      .insertInto("certificate_templates")
      .values({
        id,
        tenant_id: tenantId,
        name: data.name,
        page_size: data.page_size ?? "A4",
        orientation: data.orientation ?? "LANDSCAPE",
        background_asset_url: data.background_asset_url ?? null,
        layout: serializeJson(data.layout ?? { elements: [] }),
        // Always insert false: setDefault() is the sole writer of is_default so
        // the one-default-per-tenant invariant has a single enforcement point.
        is_default: false,
        status: data.status ?? "DRAFT",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();
    return id;
  }

  async update(
    tenantId: string,
    id: string,
    data: CertificateTemplateUpdate,
  ) {
    const set: Record<string, unknown> = { updated_at: new Date() };
    if (data.name !== undefined) set.name = data.name;
    if (data.page_size !== undefined) set.page_size = data.page_size;
    if (data.orientation !== undefined) set.orientation = data.orientation;
    if (data.background_asset_url !== undefined)
      set.background_asset_url = data.background_asset_url;
    if (data.layout !== undefined) set.layout = serializeJson(data.layout);
    if (data.status !== undefined) set.status = data.status;
    await db
      .updateTable("certificate_templates")
      .set(set)
      .where("tenant_id", "=", tenantId)
      .where("id", "=", id)
      .execute();
  }

  async remove(tenantId: string, id: string) {
    await db
      .deleteFrom("certificate_templates")
      .where("tenant_id", "=", tenantId)
      .where("id", "=", id)
      .execute();
  }

  /** Make one template the tenant default; unset any previous default. */
  async setDefault(tenantId: string, id: string) {
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("certificate_templates")
        .set({ is_default: false, updated_at: new Date() })
        .where("tenant_id", "=", tenantId)
        .execute();
      await trx
        .updateTable("certificate_templates")
        .set({ is_default: true, status: "PUBLISHED", updated_at: new Date() })
        .where("tenant_id", "=", tenantId)
        .where("id", "=", id)
        .execute();
    });
  }
}

export default new CertificateDesignerRepository();
