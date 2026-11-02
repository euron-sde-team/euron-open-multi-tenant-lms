import { ulid } from "ulid";
import { db } from "../db/connection";
import type { linkable_content_type } from "../db/enums";

/** The offering types that can carry a per-type certificate design. Only these
 *  two actually issue certificates today (course completion + test series). */
export const CERT_OFFERING_TYPES = ["COURSE", "TEST_SERIES"] as const;
export type CertOfferingType = (typeof CERT_OFFERING_TYPES)[number];

export interface CertificateAssignmentInput {
  /** Preset id (e.g. "elegant-white"). Mutually exclusive with certificate_template_id. */
  preset_template?: string | null;
  /** Custom design id (certificate_templates.id). Mutually exclusive with preset_template. */
  certificate_template_id?: string | null;
  /** Optional per-type logo (presets carry a logo). */
  certificate_logo?: string | null;
}

class CertificateAssignmentsRepository {
  /** All per-type assignments for a tenant (0..2 rows). */
  listByTenant(tenantId: string) {
    return db
      .selectFrom("tenant_certificate_assignments")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .execute();
  }

  findByType(tenantId: string, offeringType: CertOfferingType) {
    return db
      .selectFrom("tenant_certificate_assignments")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("offering_type", "=", offeringType as linkable_content_type)
      .executeTakeFirst();
  }

  /** Insert or update the assignment for (tenant, offering_type). Upserts on the
   *  [tenant_id, offering_type] unique key. */
  async upsert(tenantId: string, offeringType: CertOfferingType, input: CertificateAssignmentInput) {
    const now = new Date();
    await db
      .insertInto("tenant_certificate_assignments")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        offering_type: offeringType as linkable_content_type,
        preset_template: input.preset_template ?? null,
        certificate_template_id: input.certificate_template_id ?? null,
        certificate_logo: input.certificate_logo ?? null,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.columns(["tenant_id", "offering_type"]).doUpdateSet({
          preset_template: input.preset_template ?? null,
          certificate_template_id: input.certificate_template_id ?? null,
          certificate_logo: input.certificate_logo ?? null,
          updated_at: now,
        })
      )
      .execute();

    return this.findByType(tenantId, offeringType);
  }

  /** Remove the assignment → the type falls back to the tenant's global design. */
  async clear(tenantId: string, offeringType: CertOfferingType) {
    await db
      .deleteFrom("tenant_certificate_assignments")
      .where("tenant_id", "=", tenantId)
      .where("offering_type", "=", offeringType as linkable_content_type)
      .execute();
  }
}

export default new CertificateAssignmentsRepository();
