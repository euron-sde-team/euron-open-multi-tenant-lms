import courseCompletionService from "./course-completion.service";

import { db } from "../db/connection";
import { sql } from "kysely";
import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { getTenantEmailStyle } from "../utils/email-style.util";
import { buildTenantBrandedEmailHtml } from "../utils/email-template.util";
import logger from "../utils/logger";
import courseService from "./course.service";
import notificationService from "./notification.service";
import { getTenantBaseUrl } from "../utils/tenant-domain.util";

/**
 * The config-driven certificate design authored in the tenant-admin designer
 * and stored in `certificate_templates.layout`. Kept as a structural type here
 * (learner-api never imports the React renderer) so it can be snapshotted at
 * issue time and passed through to the web/verify clients that DO render it.
 */
export interface CertificateDesign {
  page: { size: string; orientation: string };
  background?: { assetUrl?: string | null; color?: string | null };
  elements: unknown[];
}

interface CertTemplateRow {
  id: string;
  layout: unknown;
  page_size: string;
  orientation: string;
  background_asset_url: string | null;
}

function normalizeDesign(row: CertTemplateRow): {
  id: string;
  design: CertificateDesign;
} {
  const layout = (row.layout ?? {}) as {
    background?: { assetUrl?: string | null; color?: string | null };
    elements?: unknown[];
  };
  return {
    id: row.id,
    design: {
      page: { size: row.page_size, orientation: row.orientation },
      background: {
        assetUrl: row.background_asset_url ?? layout.background?.assetUrl ?? null,
        color: layout.background?.color ?? "#ffffff",
      },
      elements: Array.isArray(layout.elements) ? layout.elements : [],
    },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Recipient email body, a link to the public verify/download page, mirroring
 *  the bulk-certificate delivery pattern (no PDF attachment; the page renders
 *  and downloads the certificate client-side). */
/**
 * A certificate is the platform's proudest moment for a learner, and it used
 * to arrive as the barest email the platform sent, an unwrapped grey div.
 * It now rides the shared tenant-branded wrapper (luxe by default, honouring
 * the tenant's simple opt-out), with an achievement panel front and centre.
 */
async function buildCertificateEmailHtml(params: {
  tenantId: string;
  recipientName: string;
  orgName: string;
  achievement: string;
  certUrl: string;
}): Promise<string> {
  const name = escapeHtml(params.recipientName || "there");
  const achievement = escapeHtml(params.achievement);
  // Escape the URL too: it's interpolated into an href attribute and body text,
  // so ampersands/quotes must be entity-encoded to stay valid (and safe) HTML.
  const url = escapeHtml(params.certUrl);
  return buildTenantBrandedEmailHtml({
    style: await getTenantEmailStyle(params.tenantId),
    tenantName: params.orgName,
    title: `Congratulations, ${name}!`,
    preheader: `You have earned a certificate for ${params.achievement}`,
    bodyHtml: `
      <p style="margin:0 0 18px;">You have earned a certificate, view, download, and share it any time.</p>
      <div style="text-align:center;padding:22px 18px;background:#f2f2f7;border-radius:14px;margin:0 0 8px;">
        <div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#8e8e93;margin-bottom:6px;">Certificate of achievement</div>
        <div style="font-size:19px;font-weight:700;color:#1c1c1e;">${achievement}</div>
      </div>
      <p style="margin:16px 0 0;font-size:12.5px;color:#a1a1aa;">Or copy this link:<br/><a href="${url}" style="color:#0a84ff;word-break:break-all;">${url}</a></p>
    `,
    ctaButton: { text: "View your certificate", url: params.certUrl },
  });
}

/** Plaintext fallback body for the certificate email (required by the
 *  notification service alongside the HTML part). */
function buildCertificateEmailText(params: {
  recipientName: string;
  orgName: string;
  achievement: string;
  certUrl: string;
}): string {
  const name = params.recipientName || "there";
  return `Congratulations, ${name}!

You have earned a certificate for "${params.achievement}" from ${params.orgName}.
View, download, and share it here:
${params.certUrl}

Sent by ${params.orgName}.`;
}

function generateCertificateNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "CERT-";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) result += "-";
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Decode the common HTML entities that show up in user-supplied strings
 * (course titles, names) stored by the admin app's rich-text editors.
 * Without this, "Smith & Co" renders as "Smith &amp; Co" on the printed
 * certificate and on the verify screen, bug #15 from QA.
 *
 * Decoded centrally here so every consumer (mobile, web, generated PDF)
 * gets the same clean string without each having to remember to decode.
 * Numeric-entity support covers the common &#39; (apostrophe) and the
 * decimal/hex forms the editor sometimes emits.
 */
function decodeHtmlEntities(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export interface GenerateCertificateResult {
  html: string;
  certificateNumber: string;
  issuedAt: string;
  templateId: string;
  courseTitle: string;
  firstName: string;
  lastName: string;
  formattedIssuedAt: string;
  logoUrl: string;
  verifyUrl: string;
  directorName: string;
  directorTitle: string;
  tenantName: string;
  /** Config-driven design (designer). Null → client renders a legacy template. */
  design: CertificateDesign | null;
  hoursText: string | null;
  lessonsCompleted: number | null;
  quizzesPassed: number | null;
  finalScore: string | null;
  testSeriesTitle: string | null;
  signatureUrl: string | null;
  expiryText: string | null;
}

export interface CertificateStatusResult {
  hasCertificate: boolean;
  certificateEnabled: boolean;
  certificateNumber?: string;
}

export interface VerifyCertificateResult {
  valid: boolean;
  certificateNumber: string;
  templateId: string;
  courseTitle: string;
  firstName: string;
  lastName: string;
  formattedIssuedAt: string;
  logoUrl: string;
  verifyUrl: string;
  directorName: string;
  directorTitle: string;
  tenantName: string;
  issuedAt: string;
  design: CertificateDesign | null;
  hoursText: string | null;
  lessonsCompleted: number | null;
  quizzesPassed: number | null;
  finalScore: string | null;
  testSeriesTitle: string | null;
  signatureUrl: string | null;
  expiryText: string | null;
}

class CertificateService {
  async generateCertificate(
    tenantId: string,
    courseId: string,
    memberId: string
  ): Promise<GenerateCertificateResult> {
    await courseService.ensureEnrolled(tenantId, courseId, memberId);

    const tenant = await db
      .selectFrom("tenants")
      .select([
        "certificate_template",
        "certificate_template_published",
        "certificate_logo",
        "name",
        "slug",
        "custom_domain",
      ])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    if (!tenant) throw new NotFoundError("Tenant not found");

    if (!tenant.certificate_template || !tenant.certificate_template_published) {
      throw new BadRequestError("Certificates are not enabled for this platform");
    }

    const course = await db
      .selectFrom("courses")
      .select(["id", "title", "duration", "certificate_template_id"])
      .where("id", "=", courseId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    if (!course) throw new NotFoundError("Course not found");

    // Eligibility counts ALL completable curriculum items, not just video
    // lectures. Counting lectures alone (a) let a course composed entirely of
    // assignments/quizzes look "complete" with zero progress, and (b) let a
    // learner skip every assignment/quiz and still claim the cert as long as
    // the videos were done.
    //
    // That definition now lives in ONE place, courseCompletionService, because
    // sequential courses asks the identical question to decide whether to unlock
    // the next course. Two copies would agree today and drift later, and the
    // drift is invisible until a learner holds a certificate for a course that
    // still won't unlock the one after it.
    const {
      done: completedCount,
      total: totalItems,
      lecturesCompleted: lessonsCompletedCount,
      quizzesCompleted: quizzesPassedCount,
    } = await courseCompletionService.getProgress(tenantId, memberId, courseId);

    if (totalItems === 0) {
      throw new BadRequestError(
        "This course has no content yet and cannot be completed."
      );
    }

    if (completedCount < totalItems) {
      // Name what is missing. "56/58 items completed" is not something a learner
      // can act on, the player shows them 100%, so the two numbers read as a
      // system fault rather than as work outstanding, and it arrives at support
      // instead of resolving itself.
      const outstanding = await courseCompletionService.getOutstandingItems(
        tenantId,
        memberId,
        courseId
      );
      const named = outstanding
        .map((i) => `${i.kind}: ${i.title}`)
        .join(", ");
      const remaining = totalItems - completedCount;
      const more =
        remaining > outstanding.length
          ? ` (and ${remaining - outstanding.length} more)`
          : "";

      throw new ForbiddenError(
        named
          ? `Course not fully completed, ${completedCount}/${totalItems} items done. Still to finish: ${named}${more}.`
          : `Course not fully completed. ${completedCount}/${totalItems} items completed.`
      );
    }

    const existing = await db
      .selectFrom("certificates")
      .select([
        "id",
        "certificate_number",
        "issued_at",
        "status",
        "template_snapshot",
      ])
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("course_id", "=", courseId)
      .executeTakeFirst();

    if (existing && existing.status === "REVOKED") {
      throw new ForbiddenError("Your certificate for this course has been revoked");
    }

    const member = await db
      .selectFrom("tenant_members")
      .select(["name", "email"])
      .where("id", "=", memberId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    if (!member) throw new NotFoundError("Member not found");

    const nameParts = (member.name || "").trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Per-offering-type assignment (Course). Threaded into design resolution
    // (custom) and applied to the preset templateId/logo below (preset).
    const courseAssignment = await this.getOfferingAssignment(tenantId, "COURSE");
    const resolved = await this.resolveCertificateDesign(
      tenantId,
      course.certificate_template_id,
      "COURSE"
    );

    let certificateNumber: string;
    let issuedAt: Date;
    let wasNewlyIssued = false;
    // The design snapshotted on the winning row (existing or race winner), used
    // in preference to the live template so a re-download shows what was awarded.
    let issuedSnapshot: unknown = existing?.template_snapshot ?? null;

    if (existing) {
      certificateNumber = existing.certificate_number;
      issuedAt = existing.issued_at instanceof Date
        ? existing.issued_at
        : new Date(existing.issued_at as unknown as string);
    } else {
      const newNumber = generateCertificateNumber();
      const now = new Date();

      // Concurrent completion heartbeats can both pass the existence check above
      // and race to insert. The unique (tenant_id, tenant_member_id, course_id)
      // constraint + onConflict.doNothing makes the loser a no-op; we then read
      // back the winner's row so both requests return the same certificate.
      const inserted = await db
        .insertInto("certificates")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          tenant_member_id: memberId,
          course_id: courseId,
          certificate_number: newNumber,
          status: "ISSUED",
          issued_at: now,
          created_at: now,
          updated_at: now,
          certificate_template_id: resolved?.id ?? null,
          template_snapshot: resolved
            ? JSON.stringify(resolved.design)
            : null,
        })
        .onConflict((oc) =>
          oc
            .columns(["tenant_id", "tenant_member_id", "course_id"])
            .doNothing()
        )
        .executeTakeFirst();

      if (Number(inserted?.numInsertedOrUpdatedRows ?? 0) > 0) {
        certificateNumber = newNumber;
        issuedAt = now;
        wasNewlyIssued = true;
      } else {
        const winner = await db
          .selectFrom("certificates")
          .select(["certificate_number", "issued_at", "template_snapshot"])
          .where("tenant_id", "=", tenantId)
          .where("tenant_member_id", "=", memberId)
          .where("course_id", "=", courseId)
          .executeTakeFirst();
        if (!winner) throw new NotFoundError("Certificate not found");
        certificateNumber = winner.certificate_number;
        issuedAt = winner.issued_at instanceof Date
          ? winner.issued_at
          : new Date(winner.issued_at as unknown as string);
        issuedSnapshot = winner.template_snapshot ?? null;
      }
    }

    // Preset resolution: a per-type PRESET assignment overrides the tenant-global
    // preset for this offering. (A per-type CUSTOM assignment flows through
    // `resolved.design` above, not here.) Falls back to the tenant preset.
    const templateId = courseAssignment?.presetTemplate || tenant.certificate_template;
    const logoUrl =
      (courseAssignment?.presetTemplate
        ? courseAssignment.certificateLogo
        : null) ??
      tenant.certificate_logo ??
      "";

    const orgDetails = await db
      .selectFrom("tenant_org_details")
      .select(["founder_name", "founder_title"])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    const directorName = orgDetails?.founder_name || tenant.name;
    const directorTitle = (orgDetails?.founder_title ?? "").trim() || "Director";

    // Resolve the tenant's REAL public domain (tenant_domains: primary ACTIVE),
    // not the legacy tenants.custom_domain column, which is often stale/empty
    // and produced verify links + QR codes pointing at the wrong domain (e.g. a
    // prod domain in dev). Same resolution the bulk-certificate flow uses.
    const baseUrl = await getTenantBaseUrl(tenantId);
    const verifyUrl = `${baseUrl}/certificate/${certificateNumber}`;

    // Auto-deliver on first issue (fire-and-forget, idempotent). The learner
    // reaching this method means the course is fully complete.
    if (wasNewlyIssued && member.email) {
      void this.emailCertificate({
        tenantId,
        recipientEmail: member.email,
        recipientName: member.name || "",
        orgName: tenant.name,
        achievement: decodeHtmlEntities(course.title),
        certificateNumber,
        verifyUrl,
        kind: "course",
      });
    }

    return {
      html: "",
      certificateNumber,
      issuedAt: issuedAt.toISOString(),
      templateId,
      // All user-supplied text fields decoded once at the server boundary.
      // clients (mobile/web/PDF renderer) never need to remember to do it.
      courseTitle: decodeHtmlEntities(course.title),
      firstName: decodeHtmlEntities(firstName),
      lastName: decodeHtmlEntities(lastName),
      formattedIssuedAt: formatDate(issuedAt),
      logoUrl,
      verifyUrl,
      directorName: decodeHtmlEntities(directorName),
      directorTitle: decodeHtmlEntities(directorTitle),
      tenantName: decodeHtmlEntities(tenant.name),
      // Prefer the design snapshotted at issue (what was actually awarded);
      // for a fresh issue the snapshot equals resolved.design, so this also
      // covers the new-cert path. Legacy certs w/o a snapshot fall to the live
      // template, then to null (client renders a legacy template).
      design:
        this.snapshotToDesign(issuedSnapshot) ?? resolved?.design ?? null,
      hoursText: (course.duration ?? "").trim() || null,
      lessonsCompleted: lessonsCompletedCount,
      quizzesPassed: quizzesPassedCount,
      finalScore: null,
      testSeriesTitle: null,
      signatureUrl: null,
      expiryText: null,
    };
  }

  /**
   * Per-offering-type certificate assignment (Course vs Test Series). Lets a
   * tenant pick a different certificate design for each offering type. Returns
   * the raw row (preset XOR custom) or null when the type has no assignment.
   * in which case resolution falls back to the tenant-global design.
   */
  private async getOfferingAssignment(
    tenantId: string,
    offeringType: "COURSE" | "TEST_SERIES"
  ): Promise<{
    presetTemplate: string | null;
    certificateTemplateId: string | null;
    certificateLogo: string | null;
  } | null> {
    const row = await db
      .selectFrom("tenant_certificate_assignments")
      .select(["preset_template", "certificate_template_id", "certificate_logo"])
      .where("tenant_id", "=", tenantId)
      .where("offering_type", "=", offeringType)
      .executeTakeFirst();
    if (!row) return null;
    return {
      presetTemplate: row.preset_template,
      certificateTemplateId: row.certificate_template_id,
      certificateLogo: row.certificate_logo,
    };
  }

  /**
   * Resolve the config-driven design for a certificate. Resolution order:
   *   1. explicit per-instance override (`overrideTemplateId`, e.g. the course's
   *      own `certificate_template_id`),
   *   2. per-offering-type assignment's custom design (when `offeringType` given),
   *   3. the tenant's default template,
   *   4. null (client falls back to a legacy 16-template render).
   * (Preset per-type assignments don't produce a `design` object, the caller
   * applies those to the preset `templateId`/logo separately.)
   */
  async resolveCertificateDesign(
    tenantId: string,
    templateId: string | null | undefined,
    offeringType?: "COURSE" | "TEST_SERIES"
  ): Promise<{ id: string; design: CertificateDesign } | null> {
    // 2. Per-offering-type assignment, used only when there's no explicit
    //    per-instance override.
    if (!templateId && offeringType) {
      const assignment = await this.getOfferingAssignment(tenantId, offeringType);
      if (assignment?.certificateTemplateId) {
        // Per-type CUSTOM design → resolve it below.
        templateId = assignment.certificateTemplateId;
      } else if (assignment?.presetTemplate) {
        // Per-type PRESET wins for this offering: return null so the caller
        // applies the preset via `templateId`/logo and we DON'T fall through to
        // the tenant's default custom design (which would override the preset).
        return null;
      }
    }
    if (templateId) {
      // Explicit per-content override: the admin deliberately selected this
      // template for this course/test, so we honor it as-is. (The designer only
      // flips a template to PUBLISHED when it's made the tenant default, so
      // requiring PUBLISHED here would silently disable every non-default
      // override.)
      const row = await db
        .selectFrom("certificate_templates")
        .select([
          "id",
          "layout",
          "page_size",
          "orientation",
          "background_asset_url",
        ])
        .where("tenant_id", "=", tenantId)
        .where("id", "=", templateId)
        .executeTakeFirst();
      if (row) return normalizeDesign(row);
    }
    // Tenant default: must be a finished, PUBLISHED design, never a half-built
    // draft. (setDefault always publishes, so this is defensive.)
    const def = await db
      .selectFrom("certificate_templates")
      .select([
        "id",
        "layout",
        "page_size",
        "orientation",
        "background_asset_url",
      ])
      .where("tenant_id", "=", tenantId)
      .where("is_default", "=", true)
      .where("status", "=", "PUBLISHED")
      .orderBy("updated_at", "desc")
      .executeTakeFirst();
    return def ? normalizeDesign(def) : null;
  }

  /** Cast a stored `template_snapshot` JSON column into a design, or null. */
  private snapshotToDesign(snapshot: unknown): CertificateDesign | null {
    if (!snapshot || typeof snapshot !== "object") return null;
    const s = snapshot as CertificateDesign;
    if (!s.page || !Array.isArray(s.elements)) return null;
    return s;
  }

  /**
   * Email the certificate to the recipient (a link to the public verify/
   * download page, same delivery model as bulk certificates). Idempotent via
   * the email engine's idempotency key; marks `emailed_at` for course certs.
   */
  private async emailCertificate(params: {
    tenantId: string;
    recipientEmail: string;
    recipientName: string;
    orgName: string;
    achievement: string;
    certificateNumber: string;
    verifyUrl: string;
    kind: "course" | "test";
  }): Promise<void> {
    try {
      const html = await buildCertificateEmailHtml({
        tenantId: params.tenantId,
        recipientName: params.recipientName,
        orgName: params.orgName,
        achievement: params.achievement,
        certUrl: params.verifyUrl,
      });
      const textBody = buildCertificateEmailText({
        recipientName: params.recipientName,
        orgName: params.orgName,
        achievement: params.achievement,
        certUrl: params.verifyUrl,
      });
      // Route through notificationService.sendCustomEmail, which tries the
      // tenant's verified sending domain first and, on "legacy" mode, falls
      // through to platform SES. Calling sendThroughEngine directly would drop
      // the email entirely for any tenant without a custom domain (the engine
      // only signals delegation there, it does not send).
      await notificationService.sendCustomEmail({
        to: params.recipientEmail,
        subject: `Your certificate from ${params.orgName}`,
        html,
        textBody,
        senderName: params.orgName,
        engineRouting: {
          tenantId: params.tenantId,
          category: "TRANSACTIONAL",
          idempotencyKey: `cert:${params.certificateNumber}`,
        },
      });
      if (params.kind === "course") {
        await db
          .updateTable("certificates")
          .set({ emailed_at: new Date() })
          .where("tenant_id", "=", params.tenantId)
          .where("certificate_number", "=", params.certificateNumber)
          .execute();
      }
    } catch (err) {
      logger.warn(
        `[certificate] auto-email failed for ${params.certificateNumber}: ${String(err)}`
      );
    }
  }

  /**
   * Fire-and-forget auto-issue: called from the progress-completion paths.
   * Reuses generateCertificate (which gates on full completion + tenant certs
   * being enabled, is idempotent, snapshots the design, and emails on first
   * issue). Swallows the expected "not complete / disabled" errors.
   */
  async maybeIssueCourseCertificateOnCompletion(
    tenantId: string,
    courseId: string,
    memberId: string
  ): Promise<void> {
    try {
      // This fires on every lecture-completion transition. Once a certificate
      // exists (issued OR revoked), there is nothing to do, short-circuit here
      // with one cheap indexed lookup instead of running generateCertificate's
      // full completion re-check (~9 queries) on every subsequent completion.
      const existing = await db
        .selectFrom("certificates")
        .select(["id"])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("course_id", "=", courseId)
        .executeTakeFirst();
      if (existing) return;

      await this.generateCertificate(tenantId, courseId, memberId);
    } catch (err) {
      if (
        err instanceof ForbiddenError ||
        err instanceof BadRequestError ||
        err instanceof NotFoundError
      ) {
        return;
      }
      logger.warn(`[certificate] auto-issue check failed: ${String(err)}`);
    }
  }

  async getCertificateStatus(
    tenantId: string,
    courseId: string,
    memberId: string
  ): Promise<CertificateStatusResult> {
    const tenant = await db
      .selectFrom("tenants")
      .select(["certificate_template", "certificate_template_published"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    const certificateEnabled = !!(
      tenant?.certificate_template && tenant?.certificate_template_published
    );

    const existing = await db
      .selectFrom("certificates")
      .select(["certificate_number", "status"])
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("course_id", "=", courseId)
      .executeTakeFirst();

    return {
      hasCertificate: !!existing && existing.status === "ISSUED",
      certificateEnabled,
      certificateNumber: existing?.status === "ISSUED" ? existing.certificate_number : undefined,
    };
  }

  async verifyCertificate(
    tenantId: string,
    certificateNumber: string
  ): Promise<VerifyCertificateResult> {
    const cert = await db
      .selectFrom("certificates")
      .select([
        "id",
        "certificate_number",
        "issued_at",
        "status",
        "course_id",
        "tenant_member_id",
        "template_snapshot",
      ])
      .where("tenant_id", "=", tenantId)
      .where("certificate_number", "=", certificateNumber)
      .executeTakeFirst();

    if (!cert) {
      // Not a course certificate, try a test certificate, then a bulk one.
      const testCert = await this.verifyTestCertificate(
        tenantId,
        certificateNumber
      );
      if (testCert) return testCert;
      return this.verifyBulkCertificate(tenantId, certificateNumber);
    }
    if (cert.status !== "ISSUED") {
      throw new NotFoundError("Certificate not found or has been revoked");
    }

    const course = await db
      .selectFrom("courses")
      .select(["title", "duration", "certificate_template_id"])
      .where("id", "=", cert.course_id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    const member = await db
      .selectFrom("tenant_members")
      .select(["name"])
      .where("id", "=", cert.tenant_member_id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    const tenant = await db
      .selectFrom("tenants")
      .select(["name", "slug", "custom_domain", "certificate_template", "certificate_logo"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    if (!tenant) throw new NotFoundError("Tenant not found");

    const orgDetails = await db
      .selectFrom("tenant_org_details")
      .select(["founder_name", "founder_title"])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    const directorTitle = (orgDetails?.founder_title ?? "").trim() || "Director";

    const nameParts = (member?.name || "").trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const issuedAt = cert.issued_at instanceof Date
      ? cert.issued_at
      : new Date(cert.issued_at as unknown as string);

    // Resolve the tenant's REAL public domain (tenant_domains: primary ACTIVE),
    // not the legacy tenants.custom_domain column, which is often stale/empty
    // and produced verify links + QR codes pointing at the wrong domain (e.g. a
    // prod domain in dev). Same resolution the bulk-certificate flow uses.
    const baseUrl = await getTenantBaseUrl(tenantId);
    const verifyUrl = `${baseUrl}/certificate/${certificateNumber}`;

    // Prefer the design snapshotted at issue (immutable record of what was
    // awarded); fall back to the live template if an older cert has no snapshot.
    const design =
      this.snapshotToDesign(cert.template_snapshot) ??
      (
        await this.resolveCertificateDesign(
          tenantId,
          course?.certificate_template_id ?? null,
          "COURSE"
        )
      )?.design ??
      null;

    // Per-offering-type PRESET override for Course (custom flows via design).
    const courseAssignment = await this.getOfferingAssignment(tenantId, "COURSE");
    const presetTemplateId =
      courseAssignment?.presetTemplate || tenant.certificate_template || "elegant-white";
    const presetLogoUrl =
      (courseAssignment?.presetTemplate ? courseAssignment.certificateLogo : null) ??
      tenant.certificate_logo ??
      "";

    const [lessonsRow, quizzesRow] = await Promise.all([
      db
        .selectFrom("member_lecture_progress")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", cert.tenant_member_id)
        .where("course_id", "=", cert.course_id)
        .where("completed", "=", true)
        .executeTakeFirst(),
      db
        .selectFrom("member_quiz_progress")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", cert.tenant_member_id)
        .where("course_id", "=", cert.course_id)
        .where("completed", "=", true)
        .executeTakeFirst(),
    ]);

    return {
      valid: true,
      certificateNumber: cert.certificate_number,
      templateId: presetTemplateId,
      courseTitle: decodeHtmlEntities(course?.title || ""),
      firstName: decodeHtmlEntities(firstName),
      lastName: decodeHtmlEntities(lastName),
      formattedIssuedAt: formatDate(issuedAt),
      logoUrl: presetLogoUrl,
      verifyUrl,
      directorName: decodeHtmlEntities(orgDetails?.founder_name || tenant.name),
      directorTitle: decodeHtmlEntities(directorTitle),
      tenantName: decodeHtmlEntities(tenant.name),
      issuedAt: issuedAt.toISOString(),
      design,
      hoursText: (course?.duration ?? "").trim() || null,
      lessonsCompleted: lessonsRow?.count ?? null,
      quizzesPassed: quizzesRow?.count ?? null,
      finalScore: null,
      testSeriesTitle: null,
      signatureUrl: null,
      expiryText: null,
    };
  }

  /**
   * Auto-issue a test certificate when a learner has earned it. Idempotent:
   * returns the existing certificate number if one was already issued for this
   * (member, test). Caller checks the test's certificate_enabled /
   * certificate_min_score_pct, but we re-check the score here defensively.
   */
  async issueTestCertificateIfEarned(params: {
    tenantId: string;
    memberId: string;
    testId: string;
    attemptId: string;
    percentage: number;
    minScorePct: number | null;
  }): Promise<{ certificateNumber: string } | null> {
    const { tenantId, memberId, testId, attemptId, percentage, minScorePct } =
      params;
    if (minScorePct != null && percentage < minScorePct) return null;

    const existing = await db
      .selectFrom("test_certificates")
      .select(["certificate_number"])
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("test_id", "=", testId)
      .where("status", "=", "ISSUED")
      .executeTakeFirst();
    if (existing) return { certificateNumber: existing.certificate_number };

    const test = await db
      .selectFrom("tests")
      .select(["name", "certificate_template_id"])
      .where("id", "=", testId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    const resolved = await this.resolveCertificateDesign(
      tenantId,
      test?.certificate_template_id ?? null,
      "TEST_SERIES"
    );

    const certificateNumber = generateCertificateNumber();
    const now = new Date();
    await db
      .insertInto("test_certificates")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        tenant_member_id: memberId,
        test_id: testId,
        attempt_id: attemptId,
        certificate_number: certificateNumber,
        status: "ISSUED",
        issued_at: now,
        created_at: now,
        updated_at: now,
        template_id: resolved?.id ?? null,
        template_snapshot: resolved ? JSON.stringify(resolved.design) : null,
      })
      .execute();

    // Auto-deliver the test-series certificate (standalone-product case).
    const [member, tenant] = await Promise.all([
      db
        .selectFrom("tenant_members")
        .select(["name", "email"])
        .where("id", "=", memberId)
        .where("tenant_id", "=", tenantId)
        .executeTakeFirst(),
      db
        .selectFrom("tenants")
        .select(["name", "slug", "custom_domain"])
        .where("id", "=", tenantId)
        .executeTakeFirst(),
    ]);
    if (member?.email && tenant) {
      const baseUrl = await getTenantBaseUrl(tenantId);
      void this.emailCertificate({
        tenantId,
        recipientEmail: member.email,
        recipientName: member.name || "",
        orgName: tenant.name,
        achievement: decodeHtmlEntities(test?.name || "Test"),
        certificateNumber,
        verifyUrl: `${baseUrl}/certificate/${certificateNumber}`,
        kind: "test",
      });
    }
    return { certificateNumber };
  }

  /** The issued test certificate for a learner+test, if any (for the result). */
  async getTestCertificateForMember(
    tenantId: string,
    memberId: string,
    testId: string
  ): Promise<{ certificateNumber: string } | null> {
    const row = await db
      .selectFrom("test_certificates")
      .select(["certificate_number"])
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("test_id", "=", testId)
      .where("status", "=", "ISSUED")
      .executeTakeFirst();
    return row ? { certificateNumber: row.certificate_number } : null;
  }

  /**
   * Resolve a TEST certificate for public verification, shaped identically to
   * a course certificate so the shared `/certificate/[number]` page renders it.
   * The test name is used as the achievement title. Returns null if not found.
   */
  private async verifyTestCertificate(
    tenantId: string,
    certificateNumber: string
  ): Promise<VerifyCertificateResult | null> {
    const cert = await db
      .selectFrom("test_certificates")
      .select([
        "certificate_number",
        "issued_at",
        "status",
        "test_id",
        "tenant_member_id",
        "attempt_id",
        "template_snapshot",
      ])
      .where("tenant_id", "=", tenantId)
      .where("certificate_number", "=", certificateNumber)
      .executeTakeFirst();
    if (!cert || cert.status !== "ISSUED") return null;

    const test = cert.test_id
      ? await db
          .selectFrom("tests")
          .select(["name", "certificate_template_id"])
          .where("id", "=", cert.test_id)
          .where("tenant_id", "=", tenantId)
          .executeTakeFirst()
      : null;

    const attempt = cert.attempt_id
      ? await db
          .selectFrom("test_attempts")
          .select(["percentage"])
          .where("id", "=", cert.attempt_id)
          .where("tenant_id", "=", tenantId)
          .executeTakeFirst()
      : null;

    const member = await db
      .selectFrom("tenant_members")
      .select(["name"])
      .where("id", "=", cert.tenant_member_id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    const tenant = await db
      .selectFrom("tenants")
      .select(["name", "slug", "custom_domain", "certificate_template", "certificate_logo"])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    if (!tenant) return null;

    const orgDetails = await db
      .selectFrom("tenant_org_details")
      .select(["founder_name", "founder_title"])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    const directorTitle = (orgDetails?.founder_title ?? "").trim() || "Director";

    const nameParts = (member?.name || "").trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const issuedAt =
      cert.issued_at instanceof Date
        ? cert.issued_at
        : new Date(cert.issued_at as unknown as string);

    // Resolve the tenant's REAL public domain (tenant_domains: primary ACTIVE),
    // not the legacy tenants.custom_domain column, which is often stale/empty
    // and produced verify links + QR codes pointing at the wrong domain (e.g. a
    // prod domain in dev). Same resolution the bulk-certificate flow uses.
    const baseUrl = await getTenantBaseUrl(tenantId);
    const verifyUrl = `${baseUrl}/certificate/${certificateNumber}`;

    const design =
      this.snapshotToDesign(cert.template_snapshot) ??
      (
        await this.resolveCertificateDesign(
          tenantId,
          test?.certificate_template_id ?? null,
          "TEST_SERIES"
        )
      )?.design ??
      null;

    // Per-offering-type PRESET override for Test Series (custom flows via design).
    const testAssignment = await this.getOfferingAssignment(tenantId, "TEST_SERIES");
    const presetTemplateId =
      testAssignment?.presetTemplate || tenant.certificate_template || "elegant-white";
    const presetLogoUrl =
      (testAssignment?.presetTemplate ? testAssignment.certificateLogo : null) ??
      tenant.certificate_logo ??
      "";

    const pct = attempt?.percentage;
    const finalScore =
      pct != null && !Number.isNaN(Number(pct))
        ? `${Math.round(Number(pct))}%`
        : null;
    const testName = decodeHtmlEntities(test?.name || "Test");

    return {
      valid: true,
      certificateNumber: cert.certificate_number,
      templateId: presetTemplateId,
      courseTitle: testName,
      firstName: decodeHtmlEntities(firstName),
      lastName: decodeHtmlEntities(lastName),
      formattedIssuedAt: formatDate(issuedAt),
      logoUrl: presetLogoUrl,
      verifyUrl,
      directorName: decodeHtmlEntities(orgDetails?.founder_name || tenant.name),
      directorTitle: decodeHtmlEntities(directorTitle),
      tenantName: decodeHtmlEntities(tenant.name),
      issuedAt: issuedAt.toISOString(),
      design,
      hoursText: null,
      lessonsCompleted: null,
      quizzesPassed: null,
      finalScore,
      testSeriesTitle: testName,
      signatureUrl: null,
      expiryText: null,
    };
  }

  /**
   * Resolve a freeform bulk certificate (issued via the tenant-admin bulk
   * generator) for public verification. Shares the same result shape as a
   * regular course certificate so the verify page renders either source
   * identically. Program name + signatory come from the parent batch.
   */
  private async verifyBulkCertificate(
    tenantId: string,
    certificateNumber: string
  ): Promise<VerifyCertificateResult> {
    const cert = await db
      .selectFrom("bulk_certificates")
      .innerJoin(
        "certificate_batches",
        "certificate_batches.id",
        "bulk_certificates.batch_id"
      )
      .select([
        "bulk_certificates.recipient_name as recipient_name",
        "bulk_certificates.certificate_number as certificate_number",
        "bulk_certificates.issued_at as issued_at",
        "bulk_certificates.status as status",
        "certificate_batches.title as title",
        "certificate_batches.template_id as template_id",
        "certificate_batches.certificate_template_id as certificate_template_id",
        "certificate_batches.template_snapshot as template_snapshot",
        "certificate_batches.signatory_name as signatory_name",
        "certificate_batches.signatory_title as signatory_title",
      ])
      .where("bulk_certificates.tenant_id", "=", tenantId)
      .where("certificate_batches.tenant_id", "=", tenantId)
      .where("bulk_certificates.certificate_number", "=", certificateNumber)
      .executeTakeFirst();

    if (!cert || cert.status !== "ISSUED") {
      throw new NotFoundError("Certificate not found or has been revoked");
    }

    const tenant = await db
      .selectFrom("tenants")
      .select(["name", "slug", "custom_domain", "certificate_template", "certificate_logo"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    if (!tenant) throw new NotFoundError("Tenant not found");

    const orgDetails = await db
      .selectFrom("tenant_org_details")
      .select(["founder_name", "founder_title"])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    const directorName =
      cert.signatory_name?.trim() || orgDetails?.founder_name || tenant.name;
    const directorTitle =
      cert.signatory_title?.trim() ||
      (orgDetails?.founder_title ?? "").trim() ||
      "Director";

    const nameParts = (cert.recipient_name || "").trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const issuedAt = cert.issued_at instanceof Date
      ? cert.issued_at
      : new Date(cert.issued_at as unknown as string);

    // Resolve the tenant's REAL public domain (tenant_domains: primary ACTIVE),
    // not the legacy tenants.custom_domain column, which is often stale/empty
    // and produced verify links + QR codes pointing at the wrong domain (e.g. a
    // prod domain in dev). Same resolution the bulk-certificate flow uses.
    const baseUrl = await getTenantBaseUrl(tenantId);
    const verifyUrl = `${baseUrl}/certificate/${certificateNumber}`;

    // A batch issued with a custom design keeps a snapshot of it. Only that
    // design is used: never the tenant default, which would restyle every
    // bulk certificate issued with a stock template.
    let design = this.snapshotToDesign(cert.template_snapshot);
    if (!design && cert.certificate_template_id) {
      const row = await db
        .selectFrom("certificate_templates")
        .select(["id", "layout", "page_size", "orientation", "background_asset_url"])
        .where("tenant_id", "=", tenantId)
        .where("id", "=", cert.certificate_template_id)
        .executeTakeFirst();
      design = row ? normalizeDesign(row as CertTemplateRow).design : null;
    }

    return {
      valid: true,
      certificateNumber: cert.certificate_number,
      templateId: cert.template_id || tenant.certificate_template || "elegant-white",
      courseTitle: cert.title || "",
      firstName,
      lastName,
      formattedIssuedAt: formatDate(issuedAt),
      logoUrl: tenant.certificate_logo || "",
      verifyUrl,
      directorName,
      directorTitle,
      tenantName: tenant.name,
      issuedAt: issuedAt.toISOString(),
      design,
      hoursText: null,
      lessonsCompleted: null,
      quizzesPassed: null,
      finalScore: null,
      testSeriesTitle: null,
      signatureUrl: null,
      expiryText: null,
    };
  }
}

export default new CertificateService();
