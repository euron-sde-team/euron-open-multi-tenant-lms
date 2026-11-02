import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";

export interface CertificateTemplateInfo {
  id: string;
  name: string;
  description: string;
  previewLabel: string;
  available: boolean;
}

const PREDEFINED_TEMPLATES: CertificateTemplateInfo[] = [
  // {
  //   id: "professional-gold",
  //   name: "Professional Gold",
  //   description:
  //     "Formal certificate with gold highlights, ornamental corners, and serif fonts",
  //   previewLabel: "Professional Gold",
  //   available: true,
  // },
  {
    id: "elegant-white",
    name: "Elegant White",
    description:
      "Warm ivory certificate with champagne gold accents, decorative borders, and refined serif typography",
    previewLabel: "Elegant White",
    available: true,
  },
  // {
  //   id: "classic-red",
  //   name: "Royal Crimson",
  //   description:
  //     "Bold certificate with rich crimson accents, cursive typography, and dark elegance",
  //   previewLabel: "Royal Crimson",
  //   available: true,
  // },
  {
    id: "modern-blue",
    name: "Modern Blue",
    description:
      "Sleek modern design with blue gradient accents on a dark navy background",
    previewLabel: "Modern Blue",
    available: true,
  },
  {
    id: "minimal-dark",
    name: "Minimal Dark",
    description: "Clean minimalist dark theme with elegant serif typography",
    previewLabel: "Minimal Dark",
    available: true,
  },
  {
    id: "academic-parchment",
    name: "Academic Parchment",
    description:
      "Traditional university credential in warm parchment with navy, muted gold, wax-style seal, and a formal ribbon sash. Includes QR verification.",
    previewLabel: "Academic Parchment",
    available: true,
  },
  {
    id: "university-formal",
    name: "University Formal",
    description:
      "Classic diploma aesthetic with burgundy frame, gold medallion, Latin-style body copy, and QR verification.",
    previewLabel: "University Formal",
    available: true,
  },
  {
    id: "corporate-executive",
    name: "Corporate Executive",
    description:
      "Modern executive credential on ivory with charcoal and teal palette, sans-serif typography, grid composition, and QR verification.",
    previewLabel: "Corporate Executive",
    available: true,
  },
  {
    id: "tech-gradient",
    name: "Tech Gradient",
    description:
      "Contemporary indigo-to-cyan gradient with geometric motifs, mono accents, and a glowing QR verification block.",
    previewLabel: "Tech Gradient",
    available: true,
  },
  {
    id: "editorial-light",
    name: "Editorial Light",
    description:
      "Magazine editorial aesthetic, generous whitespace, refined serif display, hairline rules, a single ochre accent, and QR verification.",
    previewLabel: "Editorial Light",
    available: true,
  },
  {
    id: "editorial-noir",
    name: "Editorial Noir",
    description:
      "Dark counterpart to Editorial Light with warm whites and cognac accents on a rich near-black ground. Includes QR verification.",
    previewLabel: "Editorial Noir",
    available: true,
  },
  {
    id: "masterclass-light",
    name: "Masterclass Light",
    description:
      "Minimal skill-completion credential on white with a violet accent bar and confident bold sans-serif typography. Includes QR verification.",
    previewLabel: "Masterclass Light",
    available: true,
  },
  {
    id: "masterclass-dark",
    name: "Masterclass Dark",
    description:
      "Dark counterpart to Masterclass Light, deep violet-black with a soft glow behind the recipient name. Includes QR verification.",
    previewLabel: "Masterclass Dark",
    available: true,
  },
  {
    id: "scholar-light",
    name: "Scholar Light",
    description:
      "Academic completion credential with a vertical blue ribbon, gold-rimmed logo seal, serif title, and tri-signature footer on warm ivory.",
    previewLabel: "Scholar Light",
    available: true,
  },
  {
    id: "scholar-dark",
    name: "Scholar Dark",
    description:
      "Deep-navy scholar credential with a gilded medallion and blue-to-gold ribbon, formal, modern, and balanced.",
    previewLabel: "Scholar Dark",
    available: true,
  },
  {
    id: "program-light",
    name: "Program Light",
    description:
      "Tech-corporate program credential on white with a cyan left-edge accent, pill caption, and confident bold sans-serif typography. Includes QR verification.",
    previewLabel: "Program Light",
    available: true,
  },
  {
    id: "program-dark",
    name: "Program Dark",
    description:
      "Dark counterpart to Program Light, near-black ground with a glowing cyan stripe and subtle text-shadow on the recipient name. Includes QR verification.",
    previewLabel: "Program Dark",
    available: true,
  },
  {
    id: "honors-light",
    name: "Honors Light",
    description:
      "Academic honors letterhead on warm cream with deep plum and brass gold accents, double hairline rules, and a tri-signature footer. Includes QR verification.",
    previewLabel: "Honors Light",
    available: true,
  },
  {
    id: "honors-dark",
    name: "Honors Dark",
    description:
      "Deep-aubergine honors letterhead with gilded double rules, corner fleurs, and ivory serif typography, formal and restrained. Includes QR verification.",
    previewLabel: "Honors Dark",
    available: true,
  },
];

class CertificateTemplateService {
  getTemplates(): CertificateTemplateInfo[] {
    return PREDEFINED_TEMPLATES;
  }

  async getSelected(tenantId: string): Promise<{
    templateId: string | null;
    isPublished: boolean;
    template: CertificateTemplateInfo | null;
    logoUrl: string | null;
  }> {
    const tenant = await db
      .selectFrom("tenants")
      .select(["certificate_template", "certificate_template_published", "certificate_logo"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    if (!tenant) {
      throw new NotFoundError("Tenant not found");
    }

    const templateId = tenant.certificate_template;
    const template = templateId
      ? (PREDEFINED_TEMPLATES.find((t) => t.id === templateId) ?? null)
      : null;

    return {
      templateId,
      isPublished: tenant.certificate_template_published,
      template,
      logoUrl: tenant.certificate_logo,
    };
  }

  async selectTemplate(
    tenantId: string,
    templateId: string,
    logoUrl?: string | null,
  ): Promise<{ templateId: string; template: CertificateTemplateInfo; logoUrl: string | null }> {
    const template = PREDEFINED_TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      throw new BadRequestError(`Invalid template ID: ${templateId}`);
    }
    if (!template.available) {
      throw new BadRequestError(
        `Template "${template.name}" is not yet available`,
      );
    }

    const updateData: Record<string, unknown> = {
      certificate_template: templateId,
      updated_at: new Date(),
    };
    if (logoUrl !== undefined) {
      updateData.certificate_logo = logoUrl || null;
    }

    // Both writes enforce one invariant, the selected preset is the active
    // certificate, so they must commit together. If the tenants update landed
    // but the default-designer-template unset failed, the custom design would
    // silently keep overriding the preset on every certificate issued after.
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("tenants")
        .set(updateData)
        .where("id", "=", tenantId)
        .execute();

      // Selecting a preset makes it the active certificate. Deactivate any
      // custom designer template marked as default, otherwise the default
      // config design keeps overriding this preset at issue time (a default
      // config design wins over the legacy preset during resolution).
      await trx
        .updateTable("certificate_templates")
        .set({ is_default: false, updated_at: new Date() })
        .where("tenant_id", "=", tenantId)
        .where("is_default", "=", true)
        .execute();
    });

    const tenant = await db
      .selectFrom("tenants")
      .select(["certificate_logo"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    return { templateId, template, logoUrl: tenant?.certificate_logo ?? null };
  }

  async togglePublish(
    tenantId: string,
    isPublished: boolean,
  ): Promise<{ templateId: string; isPublished: boolean }> {
    const tenant = await db
      .selectFrom("tenants")
      .select(["certificate_template", "certificate_template_published"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    if (!tenant) {
      throw new NotFoundError("Tenant not found");
    }

    if (!tenant.certificate_template) {
      throw new BadRequestError(
        "No certificate template selected. Please select a template first.",
      );
    }

    await db
      .updateTable("tenants")
      .set({
        certificate_template_published: isPublished,
        updated_at: new Date(),
      })
      .where("id", "=", tenantId)
      .execute();

    return {
      templateId: tenant.certificate_template,
      isPublished,
    };
  }
}

export const certificateTemplateService = new CertificateTemplateService();
