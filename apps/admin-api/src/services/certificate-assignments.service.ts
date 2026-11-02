import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import certificateAssignmentsRepository, {
  CERT_OFFERING_TYPES,
  type CertOfferingType,
} from "../repositories/certificate-assignments.repository";
import certificateDesignerRepository from "../repositories/certificate-designer.repository";
import { certificateTemplateService } from "./certificate-template.service";

export interface SetAssignmentInput {
  presetTemplate?: string | null;
  certificateTemplateId?: string | null;
  certificateLogo?: string | null;
}

/** The effective design for one offering type, either the per-type assignment
 *  or (when unset) the tenant's global default, so the admin UI can show what
 *  will actually be issued. `source` tells the UI which one is in effect. */
export interface EffectiveAssignment {
  offeringType: CertOfferingType;
  /** "assigned" = a per-type row is set; "default" = falls back to global. */
  source: "assigned" | "default";
  /** Preset id when a preset is in effect, else null. */
  presetTemplate: string | null;
  /** Custom design id when a custom design is in effect, else null. */
  certificateTemplateId: string | null;
  /** Custom design name (resolved) for display, when applicable. */
  certificateTemplateName: string | null;
  certificateLogo: string | null;
}

function assertOfferingType(value: string): CertOfferingType {
  if (!(CERT_OFFERING_TYPES as readonly string[]).includes(value)) {
    throw new BadRequestError(
      `offering_type must be one of: ${CERT_OFFERING_TYPES.join(", ")}`
    );
  }
  return value as CertOfferingType;
}

class CertificateAssignmentsService {
  /** Global tenant default (custom is_default design, else preset). Used as the
   *  fallback when an offering type has no assignment. */
  private async getGlobalDefault(tenantId: string): Promise<{
    presetTemplate: string | null;
    certificateTemplateId: string | null;
    certificateTemplateName: string | null;
    certificateLogo: string | null;
  }> {
    const custom = await certificateDesignerRepository.findDefault(tenantId);
    if (custom) {
      return {
        presetTemplate: null,
        certificateTemplateId: custom.id,
        certificateTemplateName: custom.name,
        certificateLogo: null,
      };
    }
    const tenant = await db
      .selectFrom("tenants")
      .select(["certificate_template", "certificate_logo"])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    return {
      presetTemplate: tenant?.certificate_template ?? null,
      certificateTemplateId: null,
      certificateTemplateName: null,
      certificateLogo: tenant?.certificate_logo ?? null,
    };
  }

  /** List the effective design for every configurable offering type. */
  async list(tenantId: string): Promise<EffectiveAssignment[]> {
    const [rows, globalDefault] = await Promise.all([
      certificateAssignmentsRepository.listByTenant(tenantId),
      this.getGlobalDefault(tenantId),
    ]);
    const byType = new Map(rows.map((r) => [r.offering_type as string, r]));

    // Resolve custom-design names in one pass for any assigned custom designs.
    const customIds = rows
      .map((r) => r.certificate_template_id)
      .filter((id): id is string => !!id);
    const nameById = new Map<string, string>();
    for (const id of customIds) {
      const design = await certificateDesignerRepository.findById(tenantId, id);
      if (design) nameById.set(id, design.name);
    }

    return CERT_OFFERING_TYPES.map((offeringType): EffectiveAssignment => {
      const row = byType.get(offeringType);
      if (row) {
        return {
          offeringType,
          source: "assigned",
          presetTemplate: row.preset_template,
          certificateTemplateId: row.certificate_template_id,
          certificateTemplateName: row.certificate_template_id
            ? (nameById.get(row.certificate_template_id) ?? null)
            : null,
          certificateLogo: row.certificate_logo,
        };
      }
      return {
        offeringType,
        source: "default",
        presetTemplate: globalDefault.presetTemplate,
        certificateTemplateId: globalDefault.certificateTemplateId,
        certificateTemplateName: globalDefault.certificateTemplateName,
        certificateLogo: globalDefault.certificateLogo,
      };
    });
  }

  /** Set the design for one offering type. Exactly one of preset/custom must be
   *  provided (preset XOR custom), mirroring the tenant-level design duality. */
  async set(tenantId: string, offeringTypeRaw: string, input: SetAssignmentInput) {
    const offeringType = assertOfferingType(offeringTypeRaw);

    const hasPreset = !!input.presetTemplate;
    const hasCustom = !!input.certificateTemplateId;
    if (hasPreset === hasCustom) {
      throw new BadRequestError(
        "Provide exactly one of presetTemplate or certificateTemplateId"
      );
    }

    if (hasPreset) {
      // Validate the preset id against the known catalog.
      const preset = certificateTemplateService
        .getTemplates()
        .find((t) => t.id === input.presetTemplate);
      if (!preset) throw new BadRequestError(`Invalid preset: ${input.presetTemplate}`);
      if (!preset.available) {
        throw new BadRequestError(`Preset "${preset.name}" is not yet available`);
      }
    } else {
      // Verify the custom design belongs to this tenant.
      const design = await certificateDesignerRepository.findById(
        tenantId,
        input.certificateTemplateId as string
      );
      if (!design) throw new NotFoundError("Certificate design not found");
    }

    await certificateAssignmentsRepository.upsert(tenantId, offeringType, {
      preset_template: hasPreset ? input.presetTemplate : null,
      certificate_template_id: hasCustom ? input.certificateTemplateId : null,
      certificate_logo: input.certificateLogo ?? null,
    });

    return this.list(tenantId);
  }

  /** Clear the per-type assignment → the type reverts to the global default. */
  async clear(tenantId: string, offeringTypeRaw: string) {
    const offeringType = assertOfferingType(offeringTypeRaw);
    await certificateAssignmentsRepository.clear(tenantId, offeringType);
    return this.list(tenantId);
  }
}

export default new CertificateAssignmentsService();
