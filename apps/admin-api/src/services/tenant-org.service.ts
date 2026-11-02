import { sql } from "kysely";
import { db } from "../db/connection";
import tenantOrgRepository, { type TenantOrgDetailsRow } from "../repositories/tenant-org.repository";
import tenantRepository from "../repositories/tenant.repository";
import tenantOrgS3Service from "./tenant-org.s3.service";
import tenantOrgContextCache from "./tenant-org-context.cache";
import footerGeneratorService from "./footer-generator.service";
import { BadRequestError } from "../errors/bad-request.error";
import { ulid } from "ulid";
import sharp from "sharp";

const MAX_WIDTH = 1920;
const QUALITY = 80;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function optimizeImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; ext: string; contentType: string }> {
  if (mimeType === "image/svg+xml") {
    return { buffer, ext: "svg", contentType: mimeType };
  }
  const metadata = await sharp(buffer).metadata();
  let pipeline = sharp(buffer).rotate();
  if (metadata.width && metadata.width > MAX_WIDTH) {
    pipeline = pipeline.resize(MAX_WIDTH, null, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const optimized = await pipeline.webp({ quality: QUALITY }).toBuffer();
  return { buffer: optimized, ext: "webp", contentType: "image/webp" };
}

class TenantOrgService {
  /**
   * Includes `name`, the academy's display name from the tenants row, even
   * though it does not live in tenant_org_details. The endpoint bills itself
   * as "where the business's real name lives", callers (the AI assistant
   * included) reach for `.name`, and until this join the payload had NO name
   * field at all: an email-campaign plan referencing it died with
   * "the earlier step returned a result that has no $sN.name in it".
   */
  async getOrgDetails(tenantId: string): Promise<TenantOrgDetailsRow & { name: string }> {
    const tenant = await tenantRepository.findById(tenantId);
    const name = tenant?.name ?? "";
    const existing = await tenantOrgRepository.findByTenantId(tenantId);
    if (existing) return { name, ...existing };
    return {
      name,
      id: "",
      tenantId,
      logoLightKey: null,
      logoDarkKey: null,
      faviconKey: null,
      tagline: null,
      description: null,
      contactEmail: null,
      supportEmail: null,
      phoneNumbers: null,
      whatsappNumbers: null,
      address: null,
      founderName: null,
      founderTitle: null,
      founderBio: null,
      founderPhotoKey: null,
      socialLinks: null,
      legalEntityName: null,
      registrationNumber: null,
      yearEstablished: null,
      industry: null,
      androidAppUrl: null,
      iosAppUrl: null,
      gstin: null,
      panNumber: null,
      billingAddress: null,
      billingEmail: null,
      billingPhone: null,
      hsnSacCode: null,
      taxId: null,
      taxMode: "INCLUSIVE",
      taxPercentage: 18,
      metadata: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * The tenant's transactional-mail design: "luxe" (default) or "simple"
   * (the opt-out). Lives in tenant_org_details.metadata.email_style so no
   * schema change was needed; the user server reads the same field when it
   * renders learner mail. Merge-writes the metadata so other keys survive.
   */
  async getEmailStyle(tenantId: string): Promise<{ email_style: "luxe" | "simple" }> {
    const existing = await tenantOrgRepository.findByTenantId(tenantId);
    const value = (existing?.metadata as Record<string, unknown> | null)?.email_style;
    return { email_style: value === "simple" ? "simple" : "luxe" };
  }

  async setEmailStyle(
    tenantId: string,
    style: unknown
  ): Promise<{ email_style: "luxe" | "simple" }> {
    if (style !== "luxe" && style !== "simple") {
      throw new BadRequestError("email_style must be \"luxe\" or \"simple\"");
    }
    const existing = await tenantOrgRepository.findByTenantId(tenantId);
    const metadata = {
      ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
      email_style: style,
    };
    await tenantOrgRepository.upsert(tenantId, { metadata });
    return { email_style: style };
  }

  async updateOrgDetails(
    tenantId: string,
    data: {
      tagline?: string | null;
      description?: string | null;
      contact_email?: string | null;
      support_email?: string | null;
      phone_numbers?: string[] | null;
      whatsapp_numbers?: string[] | null;
      address?: Record<string, unknown> | null;
      founder_name?: string | null;
      founder_title?: string | null;
      founder_bio?: string | null;
      social_links?: Record<string, unknown> | null;
      legal_entity_name?: string | null;
      registration_number?: string | null;
      year_established?: number | null;
      industry?: string | null;
      android_app_url?: string | null;
      ios_app_url?: string | null;
      gstin?: string | null;
      pan_number?: string | null;
      billing_address?: Record<string, unknown> | null;
      billing_email?: string | null;
      billing_phone?: string | null;
      hsn_sac_code?: string | null;
      tax_id?: string | null;
      tax_mode?: "INCLUSIVE" | "EXCLUSIVE" | null;
      tax_percentage?: number | null;
      metadata?: Record<string, unknown> | null;
    }
  ): Promise<TenantOrgDetailsRow> {
    if (data.contact_email && !EMAIL_REGEX.test(data.contact_email)) {
      throw new BadRequestError("Invalid contact email format");
    }
    if (data.support_email && !EMAIL_REGEX.test(data.support_email)) {
      throw new BadRequestError("Invalid support email format");
    }
    if (data.billing_email && !EMAIL_REGEX.test(data.billing_email)) {
      throw new BadRequestError("Invalid billing email format");
    }
    // Store links are shown to buyers in emails, so a typo here is a dead link
    // in every future receipt. An empty string is allowed: that CLEARS the link.
    //
    // The global xss-sanitizer HTML-encodes request bodies, so a Play Store URL
    // carrying query params arrives as "...?id=x&amp;hl=en". Decode BEFORE
    // validating and store the decoded form, otherwise every consumer (emails,
    // the site footer, the app) has to undo it, and the admin who comes back to
    // edit the field sees the entity instead of their own link.
    for (const key of ["android_app_url", "ios_app_url"] as const) {
      const raw = data[key];
      if (raw === undefined || raw === null || raw === "") continue;

      const label = key === "android_app_url" ? "Play Store" : "App Store";
      const value = raw
        .replace(/&amp;/g, "&")
        .replace(/&#x2F;/gi, "/")
        .replace(/&#0?39;/g, "'")
        .replace(/&#x27;/gi, "'")
        .trim();

      if (value.length > 500) {
        throw new BadRequestError(`${label} link must be 500 characters or less`);
      }
      // The value lands inside an href attribute, so anything that could break
      // out of it is rejected rather than escaped.
      if (/["'<>\s]/.test(value)) {
        throw new BadRequestError(`${label} link must be a single web address with no spaces`);
      }

      let parsed: URL | null = null;
      try {
        parsed = new URL(value);
      } catch {
        parsed = null;
      }
      if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
        throw new BadRequestError(`${label} link must be a full web address starting with https`);
      }

      data[key] = value;
    }
    if (data.tagline && data.tagline.length > 200) {
      throw new BadRequestError("Tagline must be 200 characters or less");
    }
    if (data.description && data.description.length > 5000) {
      throw new BadRequestError("Description must be 5000 characters or less");
    }
    if (data.tax_mode && !["INCLUSIVE", "EXCLUSIVE"].includes(data.tax_mode)) {
      throw new BadRequestError("Tax mode must be INCLUSIVE or EXCLUSIVE");
    }
    if (data.tax_percentage !== undefined && data.tax_percentage !== null) {
      if (data.tax_percentage < 0 || data.tax_percentage > 100) {
        throw new BadRequestError("Tax percentage must be between 0 and 100");
      }
    }
    const currentYear = new Date().getFullYear();
    if (
      data.year_established !== undefined &&
      data.year_established !== null &&
      (data.year_established < 1800 || data.year_established > currentYear)
    ) {
      throw new BadRequestError(`Year established must be between 1800 and ${currentYear}`);
    }
    const result = await tenantOrgRepository.upsert(tenantId, data);
    await tenantOrgContextCache.invalidate(tenantId);

    // Fire-and-forget: sync footer contact info immediately so changes are visible right away
    footerGeneratorService.syncContactInfo(tenantId).catch(() => {});

    return result;
  }

  async uploadLogo(
    tenantId: string,
    slot: "light" | "dark",
    file: Express.Multer.File
  ): Promise<TenantOrgDetailsRow> {
    const existing = await tenantOrgRepository.findByTenantId(tenantId);
    const oldKey = slot === "light" ? existing?.logoLightKey : existing?.logoDarkKey;

    const optimized = await optimizeImage(file.buffer, file.mimetype);
    const key = await tenantOrgS3Service.uploadFile(
      tenantId,
      `org/logo-${slot}_${ulid()}.${optimized.ext}`,
      optimized.buffer,
      optimized.contentType
    );

    if (oldKey) {
      await tenantOrgS3Service.deleteFile(oldKey).catch(() => {});
    }

    const fieldKey = slot === "light" ? "logo_light_key" : "logo_dark_key";
    await tenantOrgRepository.upsert(tenantId, { [fieldKey]: key });
    await tenantOrgContextCache.invalidate(tenantId);
    return this.getOrgDetails(tenantId);
  }

  async uploadFavicon(tenantId: string, file: Express.Multer.File): Promise<TenantOrgDetailsRow> {
    const ext = (file.originalname.split(".").pop() ?? "").toLowerCase();
    if (file.mimetype !== "image/x-icon" && ext !== "ico") {
      throw new BadRequestError("Only .ico files are supported for favicon");
    }

    const existing = await tenantOrgRepository.findByTenantId(tenantId);
    const oldKey = existing?.faviconKey;

    const key = await tenantOrgS3Service.uploadFile(
      tenantId,
      `org/favicon_${ulid()}.ico`,
      file.buffer,
      "image/x-icon"
    );

    if (oldKey) {
      await tenantOrgS3Service.deleteFile(oldKey).catch(() => {});
    }

    await tenantOrgRepository.upsert(tenantId, { favicon_key: key });
    await tenantOrgContextCache.invalidate(tenantId);
    return this.getOrgDetails(tenantId);
  }

  async uploadFounderPhoto(
    tenantId: string,
    file: Express.Multer.File
  ): Promise<TenantOrgDetailsRow> {
    const existing = await tenantOrgRepository.findByTenantId(tenantId);
    const oldKey = existing?.founderPhotoKey;

    const optimized = await optimizeImage(file.buffer, file.mimetype);
    const key = await tenantOrgS3Service.uploadFile(
      tenantId,
      `org/founder-photo_${ulid()}.${optimized.ext}`,
      optimized.buffer,
      optimized.contentType
    );

    if (oldKey) {
      await tenantOrgS3Service.deleteFile(oldKey).catch(() => {});
    }

    await tenantOrgRepository.upsert(tenantId, { founder_photo_key: key });
    await tenantOrgContextCache.invalidate(tenantId);
    return this.getOrgDetails(tenantId);
  }

  async deleteLogo(tenantId: string, slot: "light" | "dark"): Promise<TenantOrgDetailsRow> {
    const existing = await tenantOrgRepository.findByTenantId(tenantId);
    const key = slot === "light" ? existing?.logoLightKey : existing?.logoDarkKey;

    if (key) {
      await tenantOrgS3Service.deleteFile(key).catch(() => {});
    }

    const fieldKey = slot === "light" ? "logo_light_key" : "logo_dark_key";
    await sql`
      UPDATE tenant_org_details SET ${sql.ref(fieldKey)} = NULL, updated_at = ${new Date()}
      WHERE tenant_id = ${tenantId}
    `.execute(db);

    await tenantOrgContextCache.invalidate(tenantId);
    return this.getOrgDetails(tenantId);
  }

  async deleteFavicon(tenantId: string): Promise<TenantOrgDetailsRow> {
    const existing = await tenantOrgRepository.findByTenantId(tenantId);
    if (existing?.faviconKey) {
      await tenantOrgS3Service.deleteFile(existing.faviconKey).catch(() => {});
    }

    await sql`
      UPDATE tenant_org_details SET favicon_key = NULL, updated_at = ${new Date()}
      WHERE tenant_id = ${tenantId}
    `.execute(db);

    await tenantOrgContextCache.invalidate(tenantId);
    return this.getOrgDetails(tenantId);
  }

  async deleteFounderPhoto(tenantId: string): Promise<TenantOrgDetailsRow> {
    const existing = await tenantOrgRepository.findByTenantId(tenantId);
    if (existing?.founderPhotoKey) {
      await tenantOrgS3Service.deleteFile(existing.founderPhotoKey).catch(() => {});
    }

    await sql`
      UPDATE tenant_org_details SET founder_photo_key = NULL, updated_at = ${new Date()}
      WHERE tenant_id = ${tenantId}
    `.execute(db);

    await tenantOrgContextCache.invalidate(tenantId);
    return this.getOrgDetails(tenantId);
  }
}

export default new TenantOrgService();
