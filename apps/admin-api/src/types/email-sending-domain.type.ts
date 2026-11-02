/**
 * Email Engine, sending domain types
 * ============================================================================
 *
 * Phase 3: Sending-domain onboarding (BYO domain, opt-in).
 *
 * IMPORTANT: Legacy fallback rule (out-of-band; not enforced here):
 * Whenever a tenant has no VERIFIED sending domain OR their domain is
 * degraded, the resolver (Phase 6) returns { mode: "legacy" } and callers
 * must continue using the existing legacy SES path with the FROM line
 * formatted as `"{tenantName} <{config.legacyFromEmail}>"`. The tenant's
 * configured organization name MUST appear in the FROM display name on the
 * legacy path so end users see their tenant brand, not the platform brand.
 * Nothing in this module changes that; it only provisions the OPT-IN
 * custom-domain path.
 * ============================================================================
 */

export type DnsRecordType = "CNAME" | "MX" | "TXT";

export interface DnsRecord {
  type: DnsRecordType;
  name: string;
  value: string;
  /** Optional priority for MX records. */
  priority?: number;
  /** Human-readable hint shown in the tenant admin UI. */
  purpose: "DKIM" | "MAIL_FROM_MX" | "MAIL_FROM_SPF" | "SENDING_SPF" | "DMARC";
}

export interface OnboardSendingDomainInput {
  tenantId: string;
  subdomain: string;
}

export interface SendingDomainResponse {
  id: string;
  tenantId: string;
  subdomain: string;
  mailFromSubdomain: string;
  sesConfigurationSet: string;
  status: "PENDING" | "VERIFIED" | "FAILED" | "DISABLED";
  dkimStatus: string | null;
  mailFromStatus: string | null;
  dnsRecords: DnsRecord[];
  failureReason: string | null;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * True when the sending domain is an apex (2 labels, e.g. `example.com`).
   * The UI uses this to surface a one-time warning about reputation
   * coupling between bulk SaaS sending and any other use of the same
   * domain (corporate email, sales outreach, etc.).
   */
  isApex: boolean;
  /**
   * Whatever DMARC TXT record already exists at `_dmarc.{sendingDomain}` at
   * onboarding time, or null if none. Captured so the UI can advise the
   * tenant on whether to keep their existing DMARC (recommended on apex
   * domains where one is usually already in place) or publish the
   * default `p=none` record we generate. Set once at onboarding; not
   * refreshed by the verification poller.
   */
  existingDmarcTxt: string | null;
}
