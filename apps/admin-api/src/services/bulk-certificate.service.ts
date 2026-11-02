import { randomBytes } from "node:crypto";

import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { InternalServerError } from "../errors/internal-server.error";
import { NotFoundError } from "../errors/not-found.error";
import {
  bulkCertificateRepository,
  type BulkCertItemInput,
  type RecipientContact,
} from "../repositories/bulk-certificate.repository";
import { certificateTemplateService } from "./certificate-template.service";
import certificateDesignerRepository from "../repositories/certificate-designer.repository";
import {
  snapshotToDesign,
  toCertificateDesignSnapshot,
  type CertificateDesignSnapshot,
} from "../utils/certificate-design.util";
import notificationService from "./notification.service";
import { getTenantBaseUrl } from "../utils/tenant-domain.util";
import {
  generateCsvSample,
  generateXlsxSample,
  parseFile,
} from "./bulk-certificate.parser";

function generateCertificateNumber(): string {
  // Certificate numbers double as public verification tokens, so they must be
  // generated from a CSPRNG, never Math.random(). chars.length (32) divides
  // 256 evenly, so the modulo below introduces no bias.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  let result = "CERT-";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) result += "-";
    result += chars.charAt(bytes.readUInt8(i) % chars.length);
  }
  return result;
}

/** True when the error is a PostgreSQL unique-constraint violation (23505). */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "23505"
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

interface RawRow {
  name: string;
  email: string | null;
  issueDate: Date | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildCertificateEmailHtml(params: {
  recipientName: string;
  orgName: string;
  certUrl: string;
}): string {
  const name = escapeHtml(params.recipientName);
  const org = escapeHtml(params.orgName);
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <h2 style="color:#0f172a">Congratulations, ${name}!</h2>
    <p>${org} has issued your certificate. You can view, download, and share it using the link below.</p>
    <p style="margin:28px 0">
      <a href="${params.certUrl}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">View your certificate</a>
    </p>
    <p style="font-size:13px;color:#64748b">Or copy this link:<br/>${params.certUrl}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
    <p style="font-size:12px;color:#94a3b8">Sent by ${org}.</p>
  </div>`;
}

export interface BulkCertBatchSummary {
  id: string;
  title: string;
  templateId: string;
  /** Set when the batch uses a custom design instead of a stock template. */
  certificateTemplateId: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  totalCount: number;
  createdAt: string;
}

export interface BulkCertItem {
  id: string;
  recipientName: string;
  email: string | null;
  /** Set when the recipient email matched a registered learner account. */
  mappedMemberId: string | null;
  certificateNumber: string;
  status: string;
  issuedAt: string;
  formattedIssuedAt: string;
  emailedAt: string | null;
  verifyUrl: string;
}

export type RecipientSource =
  | { type: "course"; id: string }
  | { type: "book"; id: string }
  | { type: "emails"; contacts: RecipientContact[] };

export interface SendBatchResult {
  sent: number;
  failed: number;
  skipped: number;
}

export interface BulkCertBatchDetail {
  batch: BulkCertBatchSummary;
  templateId: string;
  /** The custom design as issued (render with ConfigCertificateRenderer), else null. */
  design: CertificateDesignSnapshot | null;
  tenantName: string;
  logoUrl: string;
  directorName: string;
  directorTitle: string;
  items: BulkCertItem[];
}

export interface CreateBatchInput {
  file: { buffer: Buffer; filename: string; mimetype?: string };
  title: string;
  /** A stock template id; null when certificateTemplateId is given. */
  templateId: string | null;
  /** One of the tenant's custom designs (certificate_templates.id). */
  certificateTemplateId?: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
}

/** Stock id stored on a batch that uses a custom design (see createFromRows). */
const CUSTOM_DESIGN_FALLBACK_PRESET = "elegant-white";

class BulkCertificateService {
  async getSample(
    format: "csv" | "xlsx",
  ): Promise<{ body: Buffer; contentType: string; filename: string }> {
    if (format === "xlsx") {
      return {
        body: await generateXlsxSample(),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: "certificate-recipients-sample.xlsx",
      };
    }
    return {
      body: generateCsvSample(),
      contentType: "text/csv",
      filename: "certificate-recipients-sample.csv",
    };
  }

  private async generateUniqueNumbers(
    tenantId: string,
    count: number,
  ): Promise<string[]> {
    const result = new Set<string>();
    let guard = 0;
    while (result.size < count) {
      const need = count - result.size;
      const candidates = new Set<string>();
      while (candidates.size < need) {
        const candidate = generateCertificateNumber();
        if (!result.has(candidate)) candidates.add(candidate);
      }
      const candidateList = [...candidates];
      const taken = await bulkCertificateRepository.findTakenCertNumbers(
        tenantId,
        candidateList,
      );
      for (const c of candidateList) {
        if (!taken.has(c)) result.add(c);
      }
      if (++guard > 50) {
        throw new InternalServerError(
          "Could not generate unique certificate numbers. Please retry.",
        );
      }
    }
    return [...result];
  }

  async createBatch(
    tenantId: string,
    createdBy: string | null,
    input: CreateBatchInput,
  ): Promise<BulkCertBatchDetail> {
    const rows = await parseFile(input.file);
    if (rows.length === 0) {
      throw new BadRequestError("No recipients found in the uploaded file.");
    }
    return this.createFromRows(
      tenantId,
      createdBy,
      input,
      rows.map((r) => ({ name: r.name, email: r.email, issueDate: r.issueDate })),
    );
  }

  /**
   * Create a batch from a recipient source (a content audience: course or
   * book) or a pasted email list, instead of an uploaded sheet.
   * Each recipient becomes a certificate dated today, auto-mapped to their
   * learner account by email.
   */
  async createBatchFromSource(
    tenantId: string,
    createdBy: string | null,
    input: Omit<CreateBatchInput, "file"> & { source: RecipientSource },
  ): Promise<BulkCertBatchDetail> {
    const contacts = await this.resolveRecipients(tenantId, input.source);
    if (contacts.length === 0) {
      throw new BadRequestError(
        "No recipients with an email were found for the selected source.",
      );
    }
    return this.createFromRows(
      tenantId,
      createdBy,
      input,
      contacts.map((c) => ({ name: c.name, email: c.email, issueDate: null })),
    );
  }

  private async createFromRows(
    tenantId: string,
    createdBy: string | null,
    meta: {
      title: string;
      templateId: string | null;
      certificateTemplateId?: string | null;
      signatoryName: string | null;
      signatoryTitle: string | null;
    },
    rows: RawRow[],
  ): Promise<BulkCertBatchDetail> {
    const title = meta.title.trim();
    if (!title) {
      throw new BadRequestError("Certificate title is required.");
    }

    // A stock template, or one of the tenant's own designs (Settings >
    // Certificates > Designer). A design is snapshotted onto the batch, the
    // same way certificates issued on completion keep theirs, so later edits
    // to the design do not change certificates already sent.
    let presetId: string;
    let designId: string | null = null;
    let designSnapshot: CertificateDesignSnapshot | null = null;
    if (meta.certificateTemplateId) {
      if (meta.templateId) {
        throw new BadRequestError("Choose a template or one of your designs, not both.");
      }
      const designRow = await certificateDesignerRepository.findById(
        tenantId,
        meta.certificateTemplateId,
      );
      if (!designRow) {
        throw new NotFoundError("Certificate design not found.");
      }
      designId = designRow.id;
      designSnapshot = toCertificateDesignSnapshot(designRow);
      // template_id stays a stock id for readers that only know presets; the
      // design wins wherever the batch is shown.
      presetId = CUSTOM_DESIGN_FALLBACK_PRESET;
    } else {
      const template = certificateTemplateService
        .getTemplates()
        .find((t) => t.id === meta.templateId);
      if (!template) {
        throw new BadRequestError(`Invalid template ID: ${meta.templateId}`);
      }
      if (!template.available) {
        throw new BadRequestError(`Template "${template.name}" is not available.`);
      }
      presetId = template.id;
    }
    if (rows.length === 0) {
      throw new BadRequestError("No recipients found.");
    }

    const now = new Date();
    const signatoryName = meta.signatoryName?.trim() || null;
    const signatoryTitle = meta.signatoryTitle?.trim() || null;

    // Auto-map rows carrying an email to a registered learner account so the
    // certificate appears in that learner's dashboard.
    const emails = rows.map((r) => r.email).filter((e): e is string => !!e);
    const memberByEmail = await bulkCertificateRepository.findMembersByEmail(
      tenantId,
      emails,
    );

    // generateUniqueNumbers checks uniqueness BEFORE the insert transaction,
    // so a concurrent batch can still grab the same number and trip the
    // (tenant_id, certificate_number) unique constraint. Retry with freshly
    // generated numbers instead of bubbling a raw PG error as a 500.
    const MAX_INSERT_ATTEMPTS = 3;
    let batchId: string | null = null;
    for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS; attempt++) {
      const numbers = await this.generateUniqueNumbers(tenantId, rows.length);
      const items: BulkCertItemInput[] = rows.map((row, i) => ({
        recipientName: row.name,
        email: row.email,
        tenantMemberId: row.email
          ? memberByEmail.get(row.email)?.id ?? null
          : null,
        certificateNumber: numbers[i] as string,
        issuedAt: row.issueDate ?? now,
      }));

      try {
        const created = await bulkCertificateRepository.createBatchWithItems({
          tenantId,
          title,
          templateId: presetId,
          certificateTemplateId: designId,
          templateSnapshot: designSnapshot,
          signatoryName,
          signatoryTitle,
          createdBy,
          items,
        });
        batchId = created.batchId;
        break;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        if (attempt === MAX_INSERT_ATTEMPTS) {
          throw new ConflictError(
            "Certificate numbers collided with a concurrent batch. Please retry the upload.",
          );
        }
      }
    }
    if (!batchId) {
      throw new InternalServerError("Failed to create certificate batch.");
    }

    return this.getBatchDetail(tenantId, batchId);
  }

  /** Resolve a recipient source to a deduplicated { name, email } list. */
  async resolveRecipients(
    tenantId: string,
    source: RecipientSource,
  ): Promise<RecipientContact[]> {
    let contacts: RecipientContact[];
    switch (source.type) {
      case "course":
        contacts = await bulkCertificateRepository.getCourseRecipients(
          tenantId,
          source.id,
        );
        break;
      case "book":
        contacts = await bulkCertificateRepository.getBookRecipients(
          tenantId,
          source.id,
        );
        break;
      case "emails":
        contacts = source.contacts;
        break;
      default:
        contacts = [];
    }
    // Dedup by email, keep first name seen; fall back to the email as the name.
    const seen = new Map<string, RecipientContact>();
    for (const c of contacts) {
      const email = c.email.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.set(email, { name: c.name?.trim() || email, email });
    }
    return [...seen.values()];
  }

  /** Email every sendable certificate in a batch (link to its verify page). */
  async sendBatch(tenantId: string, batchId: string): Promise<SendBatchResult> {
    const sendable = await bulkCertificateRepository.getSendableItems(
      tenantId,
      batchId,
    );
    const batch = await bulkCertificateRepository.getBatch(tenantId, batchId);
    if (!batch) {
      throw new NotFoundError("Certificate batch not found");
    }
    if (sendable.length === 0) {
      throw new BadRequestError(
        "No recipients left to email in this batch, they have all been emailed already or have no email address.",
      );
    }

    const tenant = await db
      .selectFrom("tenants")
      .select(["name"])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    // Resolve the tenant's real public domain the same way the rest of the
    // platform does (tenant_domains primary ACTIVE), not the legacy
    // tenants.custom_domain column which is often stale/empty.
    const baseUrl = await getTenantBaseUrl(tenantId);
    const orgName = tenant?.name || "Your academy";

    const emailedIds: string[] = [];
    let sent = 0;
    let failed = 0;
    for (const item of sendable) {
      if (!item.email) continue;
      const html = buildCertificateEmailHtml({
        recipientName: item.recipient_name,
        orgName,
        certUrl: `${baseUrl}/certificate/${item.certificate_number}`,
      });
      try {
        // Routed through the email engine so the tenant's verified sending
        // domain is used when it has one; a send failure throws.
        await notificationService.sendCustomEmail(
          item.email,
          `Your certificate from ${orgName}`,
          html,
          undefined,
          undefined,
          {
            tenantId,
            category: "TRANSACTIONAL",
            idempotencyKey: `cert:${item.certificate_number}`,
          },
        );
        emailedIds.push(item.id);
        sent++;
      } catch {
        failed++;
      }
    }
    await bulkCertificateRepository.markEmailed(tenantId, emailedIds, new Date());
    return { sent, failed, skipped: batch.total_count - sendable.length };
  }

  async listBatches(tenantId: string): Promise<BulkCertBatchSummary[]> {
    const batches = await bulkCertificateRepository.listBatches(tenantId);
    return batches.map((b) => ({
      id: b.id,
      title: b.title,
      templateId: b.template_id,
      certificateTemplateId: b.certificate_template_id ?? null,
      signatoryName: b.signatory_name,
      signatoryTitle: b.signatory_title,
      totalCount: b.total_count,
      createdAt: toDate(b.created_at).toISOString(),
    }));
  }

  async getBatchDetail(
    tenantId: string,
    batchId: string,
  ): Promise<BulkCertBatchDetail> {
    const batch = await bulkCertificateRepository.getBatch(tenantId, batchId);
    if (!batch) {
      throw new NotFoundError("Certificate batch not found");
    }

    const tenant = await db
      .selectFrom("tenants")
      .select(["name", "certificate_logo"])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    if (!tenant) {
      throw new NotFoundError("Tenant not found");
    }

    const orgDetails = await db
      .selectFrom("tenant_org_details")
      .select(["founder_name", "founder_title"])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    const directorName =
      batch.signatory_name?.trim() ||
      orgDetails?.founder_name ||
      tenant.name;
    const directorTitle =
      batch.signatory_title?.trim() ||
      (orgDetails?.founder_title ?? "").trim() ||
      "Director";

    const baseUrl = await getTenantBaseUrl(tenantId);

    const rawItems = await bulkCertificateRepository.getBatchItems(
      tenantId,
      batchId,
    );

    const items: BulkCertItem[] = rawItems.map((it) => {
      const issuedAt = toDate(it.issued_at);
      return {
        id: it.id,
        recipientName: it.recipient_name,
        email: it.email,
        mappedMemberId: it.tenant_member_id,
        certificateNumber: it.certificate_number,
        status: it.status,
        issuedAt: issuedAt.toISOString(),
        formattedIssuedAt: formatDate(issuedAt),
        emailedAt: it.emailed_at ? toDate(it.emailed_at).toISOString() : null,
        verifyUrl: `${baseUrl}/certificate/${it.certificate_number}`,
      };
    });

    return {
      batch: {
        id: batch.id,
        title: batch.title,
        templateId: batch.template_id,
        certificateTemplateId: batch.certificate_template_id ?? null,
        signatoryName: batch.signatory_name,
        signatoryTitle: batch.signatory_title,
        totalCount: batch.total_count,
        createdAt: toDate(batch.created_at).toISOString(),
      },
      templateId: batch.template_id,
      design: snapshotToDesign(batch.template_snapshot),
      tenantName: tenant.name,
      logoUrl: tenant.certificate_logo || "",
      directorName,
      directorTitle,
      items,
    };
  }

  async deleteBatch(tenantId: string, batchId: string): Promise<void> {
    const deleted = await bulkCertificateRepository.deleteBatch(
      tenantId,
      batchId,
    );
    if (deleted === 0) {
      throw new NotFoundError("Certificate batch not found");
    }
  }
}

export const bulkCertificateService = new BulkCertificateService();
export default bulkCertificateService;
