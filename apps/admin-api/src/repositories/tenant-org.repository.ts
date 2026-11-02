import { sql } from "kysely";
import { db } from "../db/connection";
import { ulid } from "ulid";

export interface TenantOrgDetailsRow {
  id: string;
  tenantId: string;
  logoLightKey: string | null;
  logoDarkKey: string | null;
  faviconKey: string | null;
  tagline: string | null;
  description: string | null;
  contactEmail: string | null;
  supportEmail: string | null;
  phoneNumbers: string[] | null;
  whatsappNumbers: string[] | null;
  address: Record<string, unknown> | null;
  founderName: string | null;
  founderTitle: string | null;
  founderBio: string | null;
  founderPhotoKey: string | null;
  socialLinks: Record<string, unknown> | null;
  legalEntityName: string | null;
  registrationNumber: string | null;
  yearEstablished: number | null;
  industry: string | null;
  /** Play Store listing, when this academy has an app. */
  androidAppUrl: string | null;
  /** App Store listing, when this academy has an app. */
  iosAppUrl: string | null;
  gstin: string | null;
  panNumber: string | null;
  billingAddress: Record<string, unknown> | null;
  billingEmail: string | null;
  billingPhone: string | null;
  hsnSacCode: string | null;
  taxId: string | null;
  taxMode: string;
  taxPercentage: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

class TenantOrgRepository {
  async findByTenantId(tenantId: string): Promise<TenantOrgDetailsRow | null> {
    const result = await sql<{
      id: string;
      tenant_id: string;
      logo_light_key: string | null;
      logo_dark_key: string | null;
      favicon_key: string | null;
      tagline: string | null;
      description: string | null;
      contact_email: string | null;
      support_email: string | null;
      phone_numbers: string[] | null;
      whatsapp_numbers: string[] | null;
      address: unknown;
      founder_name: string | null;
      founder_title: string | null;
      founder_bio: string | null;
      founder_photo_key: string | null;
      social_links: unknown;
      legal_entity_name: string | null;
      registration_number: string | null;
      year_established: number | null;
      industry: string | null;
      android_app_url: string | null;
      ios_app_url: string | null;
      metadata: unknown;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT * FROM tenant_org_details WHERE tenant_id = ${tenantId} LIMIT 1
    `.execute(db);

    const row = result.rows[0];
    if (!row) return null;
    return this.mapRow(row);
  }

  async upsert(
    tenantId: string,
    data: {
      logo_light_key?: string | null;
      logo_dark_key?: string | null;
      favicon_key?: string | null;
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
      founder_photo_key?: string | null;
      social_links?: Record<string, unknown> | null;
      legal_entity_name?: string | null;
      registration_number?: string | null;
      year_established?: number | null;
      industry?: string | null;
      /** Empty string clears the link; undefined leaves it untouched. */
      android_app_url?: string | null;
      ios_app_url?: string | null;
      gstin?: string | null;
      pan_number?: string | null;
      billing_address?: Record<string, unknown> | null;
      billing_email?: string | null;
      billing_phone?: string | null;
      hsn_sac_code?: string | null;
      tax_id?: string | null;
      tax_mode?: string | null;
      tax_percentage?: number | null;
      metadata?: Record<string, unknown> | null;
    }
  ): Promise<TenantOrgDetailsRow> {
    const now = new Date();
    const id = ulid();

    const phoneNumbers =
      data.phone_numbers !== undefined
        ? data.phone_numbers && data.phone_numbers.length > 0
          ? `{${data.phone_numbers.map((n) => `"${n}"`).join(",")}}`
          : null
        : null;
    const whatsappNumbers =
      data.whatsapp_numbers !== undefined
        ? data.whatsapp_numbers && data.whatsapp_numbers.length > 0
          ? `{${data.whatsapp_numbers.map((n) => `"${n}"`).join(",")}}`
          : null
        : null;
    const address =
      data.address !== undefined
        ? data.address
          ? JSON.stringify(data.address)
          : null
        : null;
    const socialLinks =
      data.social_links !== undefined
        ? data.social_links
          ? JSON.stringify(data.social_links)
          : null
        : null;
    const metadata =
      data.metadata !== undefined
        ? data.metadata
          ? JSON.stringify(data.metadata)
          : null
        : null;

    const billingAddress =
      data.billing_address !== undefined
        ? data.billing_address
          ? JSON.stringify(data.billing_address)
          : null
        : null;

    const result = await sql<{
      id: string;
      tenant_id: string;
      logo_light_key: string | null;
      logo_dark_key: string | null;
      favicon_key: string | null;
      tagline: string | null;
      description: string | null;
      contact_email: string | null;
      support_email: string | null;
      phone_numbers: string[] | null;
      whatsapp_numbers: string[] | null;
      address: unknown;
      founder_name: string | null;
      founder_title: string | null;
      founder_bio: string | null;
      founder_photo_key: string | null;
      social_links: unknown;
      legal_entity_name: string | null;
      registration_number: string | null;
      year_established: number | null;
      industry: string | null;
      gstin: string | null;
      pan_number: string | null;
      billing_address: unknown;
      billing_email: string | null;
      billing_phone: string | null;
      hsn_sac_code: string | null;
      tax_id: string | null;
      android_app_url: string | null;
      ios_app_url: string | null;
      metadata: unknown;
      created_at: Date;
      updated_at: Date;
    }>`
      INSERT INTO tenant_org_details (
        id, tenant_id, logo_light_key, logo_dark_key, favicon_key,
        tagline, description, contact_email, support_email,
        phone_numbers, whatsapp_numbers, address,
        founder_name, founder_title, founder_bio, founder_photo_key,
        social_links, legal_entity_name, registration_number,
        year_established, industry, android_app_url, ios_app_url,
        gstin, pan_number, billing_address, billing_email, billing_phone, hsn_sac_code, tax_id,
        tax_mode, tax_percentage,
        metadata, created_at, updated_at
      ) VALUES (
        ${id}, ${tenantId},
        ${data.logo_light_key ?? null},
        ${data.logo_dark_key ?? null},
        ${data.favicon_key ?? null},
        ${data.tagline ?? null},
        ${data.description ?? null},
        ${data.contact_email ?? null},
        ${data.support_email ?? null},
        ${phoneNumbers}::text[],
        ${whatsappNumbers}::text[],
        ${address}::jsonb,
        ${data.founder_name ?? null},
        ${data.founder_title ?? null},
        ${data.founder_bio ?? null},
        ${data.founder_photo_key ?? null},
        ${socialLinks}::jsonb,
        ${data.legal_entity_name ?? null},
        ${data.registration_number ?? null},
        ${data.year_established ?? null},
        ${data.industry ?? null},
        NULLIF(${data.android_app_url ?? null}::text, ''),
        NULLIF(${data.ios_app_url ?? null}::text, ''),
        ${data.gstin ?? null},
        ${data.pan_number ?? null},
        ${billingAddress}::jsonb,
        ${data.billing_email ?? null},
        ${data.billing_phone ?? null},
        ${data.hsn_sac_code ?? null},
        ${data.tax_id ?? null},
        ${data.tax_mode !== undefined ? data.tax_mode : "INCLUSIVE"}::"tax_mode",
        ${data.tax_percentage !== undefined ? data.tax_percentage : 18},
        ${metadata}::jsonb,
        ${now}, ${now}
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        logo_light_key      = COALESCE(EXCLUDED.logo_light_key,      tenant_org_details.logo_light_key),
        logo_dark_key       = COALESCE(EXCLUDED.logo_dark_key,       tenant_org_details.logo_dark_key),
        favicon_key         = COALESCE(EXCLUDED.favicon_key,         tenant_org_details.favicon_key),
        tagline             = COALESCE(EXCLUDED.tagline,             tenant_org_details.tagline),
        description         = COALESCE(EXCLUDED.description,         tenant_org_details.description),
        contact_email       = COALESCE(EXCLUDED.contact_email,       tenant_org_details.contact_email),
        support_email       = COALESCE(EXCLUDED.support_email,       tenant_org_details.support_email),
        phone_numbers       = CASE WHEN EXCLUDED.phone_numbers IS NOT NULL THEN EXCLUDED.phone_numbers ELSE tenant_org_details.phone_numbers END,
        whatsapp_numbers    = CASE WHEN EXCLUDED.whatsapp_numbers IS NOT NULL THEN EXCLUDED.whatsapp_numbers ELSE tenant_org_details.whatsapp_numbers END,
        address             = CASE WHEN EXCLUDED.address IS NOT NULL THEN EXCLUDED.address ELSE tenant_org_details.address END,
        founder_name        = COALESCE(EXCLUDED.founder_name,        tenant_org_details.founder_name),
        founder_title       = COALESCE(EXCLUDED.founder_title,       tenant_org_details.founder_title),
        founder_bio         = COALESCE(EXCLUDED.founder_bio,         tenant_org_details.founder_bio),
        founder_photo_key   = COALESCE(EXCLUDED.founder_photo_key,   tenant_org_details.founder_photo_key),
        social_links        = CASE WHEN EXCLUDED.social_links IS NOT NULL THEN EXCLUDED.social_links ELSE tenant_org_details.social_links END,
        legal_entity_name   = COALESCE(EXCLUDED.legal_entity_name,   tenant_org_details.legal_entity_name),
        registration_number = COALESCE(EXCLUDED.registration_number, tenant_org_details.registration_number),
        year_established    = COALESCE(EXCLUDED.year_established,    tenant_org_details.year_established),
        industry            = COALESCE(EXCLUDED.industry,            tenant_org_details.industry),
        -- An empty string CLEARS the link, so read the parameter rather than
        -- EXCLUDED (which NULLIF has already turned into NULL). COALESCE alone
        -- could only ever set a link, so a tenant who pulled their app from a
        -- store could never get that dead link out of their emails.
        android_app_url     = CASE WHEN ${data.android_app_url ?? null}::text = '' THEN NULL ELSE COALESCE(EXCLUDED.android_app_url, tenant_org_details.android_app_url) END,
        ios_app_url         = CASE WHEN ${data.ios_app_url ?? null}::text = '' THEN NULL ELSE COALESCE(EXCLUDED.ios_app_url, tenant_org_details.ios_app_url) END,
        gstin               = COALESCE(EXCLUDED.gstin,               tenant_org_details.gstin),
        pan_number          = COALESCE(EXCLUDED.pan_number,          tenant_org_details.pan_number),
        billing_address     = CASE WHEN EXCLUDED.billing_address IS NOT NULL THEN EXCLUDED.billing_address ELSE tenant_org_details.billing_address END,
        billing_email       = COALESCE(EXCLUDED.billing_email,       tenant_org_details.billing_email),
        billing_phone       = COALESCE(EXCLUDED.billing_phone,       tenant_org_details.billing_phone),
        hsn_sac_code        = COALESCE(EXCLUDED.hsn_sac_code,       tenant_org_details.hsn_sac_code),
        tax_id              = COALESCE(EXCLUDED.tax_id,              tenant_org_details.tax_id),
        tax_mode            = COALESCE(EXCLUDED.tax_mode,            tenant_org_details.tax_mode),
        tax_percentage      = COALESCE(EXCLUDED.tax_percentage,      tenant_org_details.tax_percentage),
        metadata            = CASE WHEN EXCLUDED.metadata IS NOT NULL THEN EXCLUDED.metadata ELSE tenant_org_details.metadata END,
        updated_at          = ${now}
      RETURNING *
    `.execute(db);

    return this.mapRow(result.rows[0]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapRow(row: any): TenantOrgDetailsRow {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      logoLightKey: row.logo_light_key ?? null,
      logoDarkKey: row.logo_dark_key ?? null,
      faviconKey: row.favicon_key ?? null,
      tagline: row.tagline ?? null,
      description: row.description ?? null,
      contactEmail: row.contact_email ?? null,
      supportEmail: row.support_email ?? null,
      phoneNumbers: row.phone_numbers && row.phone_numbers.length > 0 ? row.phone_numbers : null,
      whatsappNumbers: row.whatsapp_numbers && row.whatsapp_numbers.length > 0 ? row.whatsapp_numbers : null,
      address: row.address
        ? typeof row.address === "string"
          ? JSON.parse(row.address)
          : row.address
        : null,
      founderName: row.founder_name ?? null,
      founderTitle: row.founder_title ?? null,
      founderBio: row.founder_bio ?? null,
      founderPhotoKey: row.founder_photo_key ?? null,
      socialLinks: row.social_links
        ? typeof row.social_links === "string"
          ? JSON.parse(row.social_links)
          : row.social_links
        : null,
      legalEntityName: row.legal_entity_name ?? null,
      registrationNumber: row.registration_number ?? null,
      yearEstablished: row.year_established ?? null,
      industry: row.industry ?? null,
      androidAppUrl: row.android_app_url ?? null,
      iosAppUrl: row.ios_app_url ?? null,
      gstin: row.gstin ?? null,
      panNumber: row.pan_number ?? null,
      billingAddress: row.billing_address
        ? typeof row.billing_address === "string"
          ? JSON.parse(row.billing_address)
          : row.billing_address
        : null,
      billingEmail: row.billing_email ?? null,
      billingPhone: row.billing_phone ?? null,
      hsnSacCode: row.hsn_sac_code ?? null,
      taxId: row.tax_id ?? null,
      taxMode: row.tax_mode ?? "INCLUSIVE",
      taxPercentage: parseFloat(String(row.tax_percentage ?? 18)),
      metadata: row.metadata
        ? typeof row.metadata === "string"
          ? JSON.parse(row.metadata)
          : row.metadata
        : null,
      createdAt:
        row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt:
        row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }
}

export default new TenantOrgRepository();
