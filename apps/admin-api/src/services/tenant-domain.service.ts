import type { Transaction } from "kysely";
import { ulid } from "ulid";
import config from "../config";
import type { DB } from "../db/types";
import { domain_status, domain_type } from "../db/enums";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import tenantDomainRepository, {
  TenantDomain,
  TenantDomainInsert,
} from "../repositories/tenant-domain.repository";
import tenantRepository from "../repositories/tenant.repository";
import logger from "../utils/logger";
import cloudflareDomainService from "./cloudflare-domain.service";

// ─── Response Types ──────────────────────────────────────────────────────────

export interface DomainListResponse {
  id: string;
  domainType: "SUBDOMAIN" | "CUSTOM";
  domainName: string;
  subdomainPrefix: string | null;
  fullUrl: string;
  status: string;
  sslStatus: string | null;
  ownershipVerified: boolean;
  sslActive: boolean;
  isPrimary: boolean;
  errorMessage: string | null;
  createdAt: Date;
  verifiedAt: Date | null;
  linkedWwwDomainId?: string;
  linkedApexDomainId?: string;
  forwardingRequired?: boolean;
}

export interface DomainStatusResponse {
  id: string;
  domainName: string;
  domainType: string;
  status: string;
  sslStatus: string | null;
  ownershipVerified: boolean;
  sslActive: boolean;
  isPrimary: boolean;
  dnsRecords: DnsRecord[];
  verificationErrors: string[];
  verifiedAt: Date | null;
  errorMessage: string | null;
}

export interface CustomDomainResponse {
  id: string;
  domainName: string;
  status: string;
  sslStatus: string | null;
  dnsRecords: DnsRecord[];
}

export interface SubdomainDeployResponse {
  id: string;
  domainName: string;
  subdomainPrefix: string;
  fullUrl: string;
  status: string;
  isPrimary: boolean;
  alreadyExists: boolean;
  createdAt: Date;
}

export interface DnsRecord {
  type: string;
  host: string;
  value: string;
  purpose: string;
  required: boolean;
  isRootApex?: boolean;
}

// ─── Reserved Subdomains ─────────────────────────────────────────────────────

const RESERVED_SUBDOMAINS = new Set([
  "www", "admin", "api", "api-dev", "mail", "ftp",
  "staging", "dev", "app", "dashboard", "status",
  "help", "support", "docs", "blog",
]);

const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

// Two-level TLD suffixes where the apex domain has 3+ parts (e.g., example.co.uk)
const TWO_LEVEL_TLDS = new Set([
  "co.uk", "org.uk", "me.uk", "ac.uk", "gov.uk", "net.uk",
  "co.in", "org.in", "net.in", "gen.in", "firm.in", "ind.in",
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  "co.nz", "net.nz", "org.nz",
  "co.za", "org.za", "web.za",
  "com.br", "org.br", "net.br",
  "co.jp", "or.jp", "ne.jp", "ac.jp",
  "co.kr", "or.kr", "ne.kr",
  "com.cn", "net.cn", "org.cn",
  "com.tw", "org.tw", "net.tw",
  "com.hk", "org.hk", "net.hk",
  "com.sg", "org.sg", "net.sg", "edu.sg",
  "com.my", "org.my", "net.my",
  "co.id", "or.id", "web.id",
  "co.th", "or.th", "in.th",
  "com.ph", "org.ph", "net.ph",
  "com.vn", "net.vn", "org.vn",
  "com.mx", "org.mx", "net.mx",
  "com.ar", "org.ar", "net.ar",
  "co.il", "org.il", "net.il",
  "co.ke", "or.ke",
  "co.tz",
  "com.ng", "org.ng", "net.ng",
  "com.eg", "org.eg", "net.eg",
  "com.pk", "org.pk", "net.pk",
  "com.bd", "org.bd", "net.bd",
  "com.tr", "org.tr", "net.tr",
  "com.ua", "org.ua", "net.ua",
  "com.pl", "org.pl", "net.pl",
  "co.nl",
  "com.es", "org.es", "nom.es",
  "com.pt", "org.pt",
  "co.it",
]);

function isApexDomain(domain: string): boolean {
  const parts = domain.split(".");
  if (parts.length === 2) return true;
  if (parts.length < 3) return false;

  const lastTwo = parts.slice(-2).join(".");
  if (TWO_LEVEL_TLDS.has(lastTwo) && parts.length === 3) return true;

  return false;
}

function getCnameHostForSubdomain(domain: string): string {
  const parts = domain.split(".");
  const lastTwo = parts.slice(-2).join(".");
  const basePartCount = TWO_LEVEL_TLDS.has(lastTwo) ? 3 : 2;
  return parts.slice(0, -basePartCount).join(".");
}

// ─── Service ─────────────────────────────────────────────────────────────────

const APEX_SSL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

class TenantDomainService {
  private baseDomain = config.BASE_DOMAIN;

  // ──────────────────────────────────────────────────────────────────────────
  // SUBDOMAINS: No external API calls needed!
  // Wildcard *.<ROOT_DOMAIN> handles DNS + SSL automatically.
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Register a subdomain for a tenant.
   * With Cloudflare wildcard DNS, this is just a database operation.
   *
   * Accepts an optional `trx` so callers can include the registration in
   * a larger transaction (e.g. provisioning), keeping the tenant row
   * and its hostname mapping atomic.
   */
  async registerSubdomain(
    tenantId: string,
    slug: string,
    trx?: Transaction<DB>
  ): Promise<TenantDomain> {
    const existing = await tenantDomainRepository.findSubdomainByTenantId(tenantId, trx);
    if (existing) {
      return existing;
    }

    if (!slug || !SLUG_REGEX.test(slug)) {
      throw new BadRequestError(
        "Invalid subdomain slug. Use lowercase letters, numbers, and hyphens."
      );
    }

    if (RESERVED_SUBDOMAINS.has(slug)) {
      throw new BadRequestError("This subdomain is reserved");
    }

    const domainName = `${slug}.${this.baseDomain}`;

    const domainExists = await tenantDomainRepository.domainNameExists(domainName, undefined, trx);
    if (domainExists) {
      throw new ConflictError(`Domain ${domainName} is already registered`);
    }

    const domainData: TenantDomainInsert = {
      id: ulid(),
      tenant_id: tenantId,
      domain_type: domain_type.SUBDOMAIN,
      domain_name: domainName,
      subdomain_prefix: slug,
      status: domain_status.ACTIVE,
      ownership_verified: true,
      ssl_active: true,
      is_primary: true,
    };

    return tenantDomainRepository.create(domainData, trx);
  }

  /**
   * Deploy subdomain for a tenant (called via API).
   * Returns existing subdomain if already deployed, otherwise creates new one.
   */
  async deploySubdomainForTenant(tenantId: string): Promise<SubdomainDeployResponse> {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError("Tenant not found");
    }

    const existing = await tenantDomainRepository.findSubdomainByTenantId(tenantId);
    if (existing) {
      const prefix = existing.subdomain_prefix || tenant.slug;
      const expectedDomainName = `${prefix}.${this.baseDomain}`;

      // Self-heal: update stored domain_name if base domain has changed (e.g., .com → .info env switch)
      if (existing.domain_name !== expectedDomainName) {
        await tenantDomainRepository.update(existing.id, { domain_name: expectedDomainName });
        logger.info(
          `[Domain] Subdomain migrated: ${existing.domain_name} → ${expectedDomainName}`
        );
      }

      const domainName = existing.domain_name !== expectedDomainName ? expectedDomainName : existing.domain_name;
      return {
        id: existing.id,
        domainName,
        subdomainPrefix: prefix,
        fullUrl: `https://${domainName}`,
        status: existing.status,
        isPrimary: existing.is_primary,
        alreadyExists: true,
        createdAt: existing.created_at,
      };
    }

    const domain = await this.registerSubdomain(tenantId, tenant.slug);

    return {
      id: domain.id,
      domainName: domain.domain_name,
      subdomainPrefix: tenant.slug,
      fullUrl: `https://${domain.domain_name}`,
      status: domain.status,
      isPrimary: domain.is_primary,
      alreadyExists: false,
      createdAt: domain.created_at,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CUSTOM DOMAINS: Cloudflare for SaaS API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Add a custom domain for a tenant.
   * Registers with Cloudflare for SaaS and returns DNS instructions.
   */
  async addCustomDomain(
    tenantId: string,
    customDomain: string
  ): Promise<CustomDomainResponse> {
    const domainRegex = /^(?!-)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(customDomain)) {
      throw new BadRequestError("Invalid domain format");
    }

    let normalizedDomain = customDomain.toLowerCase().trim();
    if (normalizedDomain.startsWith("www.")) {
      normalizedDomain = normalizedDomain.slice(4);
    }

    if (
      normalizedDomain === this.baseDomain ||
      normalizedDomain.endsWith(`.${this.baseDomain}`)
    ) {
      throw new BadRequestError(
        "Cannot add a subdomain of the platform domain as a custom domain"
      );
    }

    const domainExists = await tenantDomainRepository.domainNameExists(normalizedDomain);
    const wwwExists = await tenantDomainRepository.domainNameExists(`www.${normalizedDomain}`);
    if (domainExists || wwwExists) {
      throw new ConflictError("This domain is already registered");
    }

    const isApex = isApexDomain(normalizedDomain);

    if (isApex) {
      const apexCfResult = await cloudflareDomainService.registerCustomHostname(
        normalizedDomain,
        tenantId
      );
      const apexStatus = this.mapCloudflareStatusToInternal(apexCfResult.status, apexCfResult.sslStatus);

      let wwwHostnameId: string | null = null;
      let wwwStatus: domain_status = domain_status.PENDING_VERIFICATION;
      let wwwSslStatus: string | null = null;
      let wwwOwnershipVerified = false;
      let wwwSslActive = false;
      let wwwVerificationRecords: unknown = null;

      try {
        const wwwCfResult = await cloudflareDomainService.registerCustomHostname(
          `www.${normalizedDomain}`,
          tenantId
        );
        wwwHostnameId = wwwCfResult.cloudflareHostnameId;
        wwwStatus = this.mapCloudflareStatusToInternal(wwwCfResult.status, wwwCfResult.sslStatus);
        wwwSslStatus = wwwCfResult.sslStatus;
        wwwOwnershipVerified = wwwCfResult.ownershipVerified;
        wwwSslActive = wwwCfResult.sslActive;
        wwwVerificationRecords = wwwCfResult.verificationRecords;
      } catch (err) {
        logger.warn(`[Domain] www registration failed (non-fatal): ${err}`);
      }

      const apexDomain = await tenantDomainRepository.create({
        id: ulid(),
        tenant_id: tenantId,
        domain_type: domain_type.CUSTOM,
        domain_name: normalizedDomain,
        hostname_id: apexCfResult.cloudflareHostnameId,
        status: apexStatus,
        ssl_status: apexCfResult.sslStatus,
        ownership_verified: apexCfResult.ownershipVerified,
        ssl_active: apexCfResult.sslActive,
        verification_records: apexCfResult.verificationRecords,
        is_primary: false,
      });

      if (wwwHostnameId) {
        await tenantDomainRepository.create({
          id: ulid(),
          tenant_id: tenantId,
          domain_type: domain_type.CUSTOM,
          domain_name: `www.${normalizedDomain}`,
          hostname_id: wwwHostnameId,
          status: wwwStatus,
          ssl_status: wwwSslStatus,
          ownership_verified: wwwOwnershipVerified,
          ssl_active: wwwSslActive,
          verification_records: wwwVerificationRecords,
          is_primary: false,
        });
      }

      const dnsRecords = this.buildDnsInstructions(normalizedDomain, apexCfResult.verificationRecords);

      return {
        id: apexDomain.id,
        domainName: apexDomain.domain_name,
        status: apexDomain.status,
        sslStatus: apexDomain.ssl_status,
        dnsRecords,
      };
    }

    const cfResult = await cloudflareDomainService.registerCustomHostname(
      normalizedDomain,
      tenantId
    );

    const status = this.mapCloudflareStatusToInternal(cfResult.status, cfResult.sslStatus);

    const domain = await tenantDomainRepository.create({
      id: ulid(),
      tenant_id: tenantId,
      domain_type: domain_type.CUSTOM,
      domain_name: normalizedDomain,
      hostname_id: cfResult.cloudflareHostnameId,
      status,
      ssl_status: cfResult.sslStatus,
      ownership_verified: cfResult.ownershipVerified,
      ssl_active: cfResult.sslActive,
      verification_records: cfResult.verificationRecords,
      is_primary: false,
    });

    const dnsRecords = this.buildDnsInstructions(normalizedDomain, cfResult.verificationRecords);

    return {
      id: domain.id,
      domainName: domain.domain_name,
      status: domain.status,
      sslStatus: domain.ssl_status,
      dnsRecords,
    };
  }

  /**
   * Verify a custom domain by polling Cloudflare for current status.
   * Can be triggered manually by tenant or by the BullMQ polling job.
   */
  async verifyCustomDomain(
    domainId: string,
    tenantId: string
  ): Promise<DomainStatusResponse> {
    const domain = await this.getDomainById(domainId, tenantId);

    if (domain.domain_type === domain_type.SUBDOMAIN) {
      return this.buildDomainStatusResponse(domain);
    }

    if (domain.status === domain_status.ACTIVE) {
      return this.buildDomainStatusResponse(domain);
    }

    if (!domain.hostname_id) {
      return this.buildDomainStatusResponse(domain);
    }

    try {
      const live = await cloudflareDomainService.getHostnameStatus(domain.hostname_id);
      const newStatus = this.mapCloudflareStatusToInternal(live.status, live.sslStatus);
      const isNowActive = newStatus === domain_status.ACTIVE;

      await tenantDomainRepository.update(domain.id, {
        status: newStatus,
        ssl_status: live.sslStatus,
        ownership_verified: live.ownershipVerified,
        ssl_active: live.sslActive,
        verification_records: live.verificationRecords,
        error_message: live.verificationErrors.length > 0
          ? live.verificationErrors.join("; ")
          : null,
        verified_at: isNowActive && !domain.verified_at ? new Date() : undefined,
      });

      const updated = await tenantDomainRepository.findById(domain.id);
      return this.buildDomainStatusResponse(updated || domain, live.verificationErrors);
    } catch (error) {
      logger.error(`[Domain] Failed to poll Cloudflare for ${domain.domain_name}:`, error);
      return this.buildDomainStatusResponse(domain);
    }
  }

  /**
   * Retry verification for a failed custom domain.
   * Triggers Cloudflare to re-validate ownership + SSL.
   */
  async retryCustomDomain(
    domainId: string,
    tenantId: string
  ): Promise<DomainStatusResponse> {
    const domain = await this.getDomainById(domainId, tenantId);

    if (domain.domain_type !== domain_type.CUSTOM) {
      throw new BadRequestError("Only custom domains can be retried");
    }

    if (!domain.hostname_id) {
      throw new BadRequestError("Domain has no Cloudflare hostname ID");
    }

    try {
      const refreshed = await cloudflareDomainService.refreshVerification(domain.hostname_id);
      const newStatus = this.mapCloudflareStatusToInternal(
        refreshed.status,
        refreshed.sslStatus
      );

      await tenantDomainRepository.update(domain.id, {
        status: newStatus,
        ssl_status: refreshed.sslStatus,
        ownership_verified: refreshed.ownershipVerified,
        ssl_active: refreshed.sslActive,
        verification_records: refreshed.verificationRecords,
        error_message: null,
      });

      const updated = await tenantDomainRepository.findById(domain.id);
      return this.buildDomainStatusResponse(updated || domain);
    } catch (error) {
      logger.error(`[Domain] Retry failed for ${domain.domain_name}:`, error);
      throw new BadRequestError("Failed to retry domain verification");
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SHARED OPERATIONS
  // ──────────────────────────────────────────────────────────────────────────

  async getDomainsForTenant(tenantId: string): Promise<DomainListResponse[]> {
    const domains = await tenantDomainRepository.findByTenantId(tenantId);

    const domainsByName = new Map(domains.map((d) => [d.domain_name, d]));

    return domains.map((domain) => {
      let linkedWwwDomainId: string | undefined;
      let linkedApexDomainId: string | undefined;

      const isApex = isApexDomain(domain.domain_name);
      if (isApex) {
        const wwwRecord = domainsByName.get(`www.${domain.domain_name}`);
        if (wwwRecord) linkedWwwDomainId = wwwRecord.id;
      }

      if (domain.domain_name.startsWith("www.")) {
        const apexName = domain.domain_name.slice(4);
        const apexRecord = domainsByName.get(apexName);
        if (apexRecord) linkedApexDomainId = apexRecord.id;
      }

      return {
        id: domain.id,
        domainType: domain.domain_type as "SUBDOMAIN" | "CUSTOM",
        domainName: domain.domain_name,
        subdomainPrefix: domain.subdomain_prefix,
        fullUrl: `https://${domain.domain_name}`,
        status: domain.status,
        sslStatus: domain.ssl_status,
        ownershipVerified: domain.ownership_verified,
        sslActive: domain.ssl_active,
        isPrimary: domain.is_primary,
        errorMessage: domain.error_message,
        createdAt: domain.created_at,
        verifiedAt: domain.verified_at,
        linkedWwwDomainId,
        linkedApexDomainId,
        forwardingRequired: domain.status === domain_status.REDIRECT,
      };
    });
  }

  async getDomainById(domainId: string, tenantId: string): Promise<TenantDomain> {
    const domain = await tenantDomainRepository.findById(domainId);

    if (!domain) {
      throw new NotFoundError("Domain not found");
    }

    if (domain.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this domain");
    }

    return domain;
  }

  async removeDomain(domainId: string, tenantId: string): Promise<void> {
    const domain = await this.getDomainById(domainId, tenantId);

    if (domain.domain_type === domain_type.CUSTOM) {
      if (domain.hostname_id) {
        try {
          await cloudflareDomainService.removeCustomHostname(domain.hostname_id);
        } catch (error) {
          logger.warn(`[Domain] Cloudflare removal failed for ${domain.domain_name}: ${error}`);
        }
      }

      const isApex = isApexDomain(domain.domain_name);
      if (isApex) {
        const wwwRecord = await tenantDomainRepository.findByDomainName(
          `www.${domain.domain_name}`
        );
        if (wwwRecord && wwwRecord.tenant_id === tenantId) {
          if (wwwRecord.hostname_id) {
            try {
              await cloudflareDomainService.removeCustomHostname(wwwRecord.hostname_id);
            } catch (err) {
              logger.warn(`[Domain] www Cloudflare removal failed: ${err}`);
            }
          }
          await tenantDomainRepository.delete(wwwRecord.id);
        }
      }

      if (domain.domain_name.startsWith("www.")) {
        const apexName = domain.domain_name.slice(4);
        const apexRecord = await tenantDomainRepository.findByDomainName(apexName);
        if (apexRecord && apexRecord.tenant_id === tenantId) {
          await tenantDomainRepository.delete(apexRecord.id);
        }
      }
    }

    if (domain.is_primary) {
      const remainingDomains = await tenantDomainRepository.findByTenantId(tenantId);
      const idsToRemove = new Set([domainId]);
      if (domain.domain_name.startsWith("www.")) {
        const apexName = domain.domain_name.slice(4);
        const apexRecord = remainingDomains.find((d) => d.domain_name === apexName);
        if (apexRecord) idsToRemove.add(apexRecord.id);
      }
      const otherDomain = remainingDomains.find((d) => !idsToRemove.has(d.id));
      if (otherDomain) {
        await tenantDomainRepository.setPrimary(otherDomain.id, tenantId);
      }
    }

    await tenantDomainRepository.delete(domainId);
  }

  async setDomainAsPrimary(domainId: string, tenantId: string): Promise<TenantDomain> {
    const domain = await this.getDomainById(domainId, tenantId);

    if (domain.status === domain_status.REDIRECT) {
      const wwwRecord = await tenantDomainRepository.findByDomainName(
        `www.${domain.domain_name}`
      );
      if (!wwwRecord || wwwRecord.status !== domain_status.ACTIVE) {
        throw new BadRequestError(
          "Cannot set as primary, the www variant is not yet active"
        );
      }
    } else if (domain.status !== domain_status.ACTIVE) {
      throw new BadRequestError("Only active domains can be set as primary");
    }

    const updatedDomain = await tenantDomainRepository.setPrimary(domainId, tenantId);
    if (!updatedDomain) {
      throw new NotFoundError("Domain not found after update");
    }

    if (domain.domain_type === domain_type.CUSTOM) {
      await tenantRepository.update(tenantId, {
        custom_domain: domain.domain_name,
      });
    }

    return updatedDomain;
  }

  getSubdomainUrl(slug: string): string {
    return `https://${slug}.${this.baseDomain}`;
  }

  /**
   * Poll all pending custom domains, called by BullMQ recurring job.
   */
  async pollPendingDomains(): Promise<void> {
    const pending = await tenantDomainRepository.findPendingCustomDomains();

    if (pending.length === 0) return;

    logger.info(`[Domain] Polling ${pending.length} pending custom domain(s)`);

    for (const record of pending) {
      if (!record.hostname_id) continue;

      const isApex = isApexDomain(record.domain_name);
      const ageMs = Date.now() - record.created_at.getTime();

      if (
        isApex &&
        record.status === domain_status.PENDING_SSL &&
        ageMs > APEX_SSL_TIMEOUT_MS
      ) {
        try {
          await cloudflareDomainService.removeCustomHostname(record.hostname_id);
        } catch (err) {
          logger.warn(`[Domain] Failed to remove CF hostname for ${record.domain_name}: ${err}`);
        }

        const errorMessage =
          `Your DNS provider does not support CNAME records on the root domain. ` +
          `To fix this, set up forwarding from ${record.domain_name} to www.${record.domain_name} at your registrar.`;

        await tenantDomainRepository.update(record.id, {
          status: domain_status.REDIRECT,
          hostname_id: null,
          ssl_status: null,
          ssl_active: false,
          error_message: errorMessage,
        });

        logger.warn(
          `[Domain] Apex domain ${record.domain_name} stuck in PENDING_SSL for ${Math.round(ageMs / 60000)}min, downgraded to REDIRECT`
        );
        continue;
      }

      try {
        const live = await cloudflareDomainService.getHostnameStatus(record.hostname_id);
        const newStatus = this.mapCloudflareStatusToInternal(live.status, live.sslStatus);

        if (newStatus !== record.status || live.sslStatus !== record.ssl_status) {
          await tenantDomainRepository.update(record.id, {
            status: newStatus,
            ssl_status: live.sslStatus,
            ownership_verified: live.ownershipVerified,
            ssl_active: live.sslActive,
            verification_records: live.verificationRecords,
            error_message: live.verificationErrors.length > 0
              ? live.verificationErrors.join("; ")
              : null,
            verified_at: newStatus === domain_status.ACTIVE && !record.verified_at
              ? new Date()
              : undefined,
          });
        }

        if (newStatus === domain_status.ACTIVE && record.status !== domain_status.ACTIVE) {
          logger.info(`[Domain] ${record.domain_name} is now ACTIVE`);
        }
      } catch (err) {
        logger.warn(`[Domain] Poll failed for ${record.domain_name}: ${err}`);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  private mapCloudflareStatusToInternal(
    cfStatus: string,
    sslStatus: string
  ): domain_status {
    if (cfStatus === "active" && sslStatus === "active") {
      return domain_status.ACTIVE;
    }
    if (cfStatus === "active" && sslStatus !== "active") {
      return domain_status.PENDING_SSL;
    }
    if (cfStatus === "pending") {
      return domain_status.PENDING_VERIFICATION;
    }
    if (cfStatus === "moved" || cfStatus === "deleted") {
      return domain_status.FAILED;
    }
    return domain_status.PENDING_VERIFICATION;
  }

  private buildDnsInstructions(
    domain: string,
    verificationRecords?: {
      ownershipVerification?: { type: string; name: string; value: string };
      sslValidation?: Array<{ type: string; name: string; value: string }>;
    }
  ): DnsRecord[] {
    const isApex = isApexDomain(domain);
    const cnameTarget = cloudflareDomainService.getCnameTarget();
    const records: DnsRecord[] = [];

    if (isApex) {
      records.push({
        type: "CNAME",
        host: "@",
        value: cnameTarget,
        purpose: "Points your root domain to our platform",
        required: true,
        isRootApex: true,
      });
      records.push({
        type: "CNAME",
        host: "www",
        value: cnameTarget,
        purpose: "Points www to our platform (required for SSL)",
        required: true,
      });
      records.push({
        type: "FORWARDING",
        host: "@",
        value: `https://www.${domain}`,
        purpose:
          "Fallback: If your registrar doesn't support root CNAME, set up forwarding to www instead",
        required: false,
        isRootApex: true,
      });
    } else {
      const cnameHost = getCnameHostForSubdomain(domain);
      records.push({
        type: "CNAME",
        host: cnameHost,
        value: cnameTarget,
        purpose: `Points ${domain} to our platform`,
        required: true,
      });
    }

    if (verificationRecords?.ownershipVerification) {
      records.push({
        type: "TXT",
        host: verificationRecords.ownershipVerification.name,
        value: verificationRecords.ownershipVerification.value,
        purpose: "Domain ownership verification",
        required: true,
      });
    }

    if (verificationRecords?.sslValidation) {
      for (const sv of verificationRecords.sslValidation) {
        records.push({
          type: sv.type,
          host: sv.name,
          value: sv.value,
          purpose: "SSL certificate verification",
          required: true,
        });
      }
    }

    return records;
  }

  private buildDomainStatusResponse(
    domain: TenantDomain,
    verificationErrors: string[] = []
  ): DomainStatusResponse {
    const vr = domain.verification_records as {
      ownershipVerification?: { type: string; name: string; value: string };
      sslValidation?: Array<{ type: string; name: string; value: string }>;
    } | null;

    const dnsRecords = domain.domain_type === domain_type.CUSTOM
      ? this.buildDnsInstructions(domain.domain_name, vr ?? undefined)
      : [];

    return {
      id: domain.id,
      domainName: domain.domain_name,
      domainType: domain.domain_type,
      status: domain.status,
      sslStatus: domain.ssl_status,
      ownershipVerified: domain.ownership_verified,
      sslActive: domain.ssl_active,
      isPrimary: domain.is_primary,
      dnsRecords,
      verificationErrors,
      verifiedAt: domain.verified_at,
      errorMessage: domain.error_message,
    };
  }
}

export default new TenantDomainService();
