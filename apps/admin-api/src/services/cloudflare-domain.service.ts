import config from "../config";
import { BadRequestError } from "../errors/bad-request.error";
import { InternalServerError } from "../errors/internal-server.error";
import logger from "../utils/logger";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export interface CloudflareHostnameResult {
  cloudflareHostnameId: string;
  hostname: string;
  status: string;
  sslStatus: string;
  ownershipVerified: boolean;
  sslActive: boolean;
  verificationRecords: CloudflareVerificationRecords;
  verificationErrors: string[];
}

export interface CloudflareVerificationRecords {
  ownershipVerification?: { type: string; name: string; value: string };
  sslValidation?: Array<{ type: string; name: string; value: string }>;
}

export interface CloudflareHostnameStatus {
  status: string;
  sslStatus: string;
  ownershipVerified: boolean;
  sslActive: boolean;
  verificationRecords: CloudflareVerificationRecords;
  verificationErrors: string[];
}

class CloudflareDomainService {
  private apiToken: string;
  private zoneId: string;
  private cnameTarget: string;

  constructor() {
    this.apiToken = config.CLOUDFLARE_API_TOKEN;
    this.zoneId = config.CLOUDFLARE_ZONE_ID;
    this.cnameTarget = config.CLOUDFLARE_CNAME_TARGET;
  }

  private validateConfig(): void {
    if (!this.apiToken) {
      logger.error("Cloudflare API token is not configured");
      throw new InternalServerError("Custom domain service is not available. Please contact support.");
    }
    if (!this.zoneId) {
      logger.error("Cloudflare Zone ID is not configured");
      throw new InternalServerError("Custom domain service is not available. Please contact support.");
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    this.validateConfig();

    const url = `${CF_API_BASE}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = (await response.json()) as {
      success: boolean;
      result: T;
      errors?: Array<{ code: number; message: string }>;
    };

    if (!data.success) {
      const errorMsg = data.errors?.map((e) => e.message).join(", ") || "Cloudflare API error";
      logger.error(`[Cloudflare] API error: ${method} ${path}, ${errorMsg}`);

      if (response.status === 400) {
        throw new BadRequestError(errorMsg);
      }
      throw new InternalServerError("Failed to configure custom domain. Please try again or contact support.");
    }

    return data.result;
  }

  /**
   * Register a custom hostname with Cloudflare for SaaS.
   * Uses HTTP DCV (domain control validation) so tenants only need a CNAME.
   */
  async registerCustomHostname(
    hostname: string,
    tenantId: string
  ): Promise<CloudflareHostnameResult> {
    logger.info(`[Cloudflare] Registering custom hostname: ${hostname} for tenant ${tenantId}`);

    const result = await this.request<{
      id: string;
      hostname: string;
      status: string;
      ssl: {
        status: string;
        validation_records?: Array<{
          txt_name?: string;
          txt_value?: string;
          cname?: string;
          cname_target?: string;
          http_url?: string;
          http_body?: string;
        }>;
      };
      ownership_verification?: {
        type: string;
        name: string;
        value: string;
      };
      ownership_verification_http?: {
        http_url: string;
        http_body: string;
      };
      verification_errors?: string[];
    }>("POST", `/zones/${this.zoneId}/custom_hostnames`, {
      hostname,
      ssl: {
        method: "http",
        type: "dv",
        settings: {
          min_tls_version: "1.2",
        },
      },
    });

    const verificationRecords: CloudflareVerificationRecords = {};

    if (result.ownership_verification) {
      verificationRecords.ownershipVerification = {
        type: result.ownership_verification.type,
        name: result.ownership_verification.name,
        value: result.ownership_verification.value,
      };
    }

    if (result.ssl?.validation_records) {
      verificationRecords.sslValidation = result.ssl.validation_records
        .filter((r) => r.txt_name && r.txt_value)
        .map((r) => ({
          type: "TXT",
          name: r.txt_name!,
          value: r.txt_value!,
        }));
    }

    logger.info(
      `[Cloudflare] Hostname registered: ${result.id}, status: ${result.status}, ssl: ${result.ssl?.status}`
    );

    return {
      cloudflareHostnameId: result.id,
      hostname: result.hostname,
      status: result.status,
      sslStatus: result.ssl?.status || "initializing",
      ownershipVerified: result.status === "active",
      sslActive: result.ssl?.status === "active",
      verificationRecords,
      verificationErrors: result.verification_errors || [],
    };
  }

  /**
   * Get the current status of a custom hostname from Cloudflare.
   */
  async getHostnameStatus(hostnameId: string): Promise<CloudflareHostnameStatus> {
    const result = await this.request<{
      id: string;
      hostname: string;
      status: string;
      ssl: {
        status: string;
        validation_records?: Array<{
          txt_name?: string;
          txt_value?: string;
          cname?: string;
          cname_target?: string;
        }>;
      };
      ownership_verification?: {
        type: string;
        name: string;
        value: string;
      };
      verification_errors?: string[];
    }>("GET", `/zones/${this.zoneId}/custom_hostnames/${hostnameId}`);

    const verificationRecords: CloudflareVerificationRecords = {};

    if (result.ownership_verification) {
      verificationRecords.ownershipVerification = {
        type: result.ownership_verification.type,
        name: result.ownership_verification.name,
        value: result.ownership_verification.value,
      };
    }

    if (result.ssl?.validation_records) {
      verificationRecords.sslValidation = result.ssl.validation_records
        .filter((r) => r.txt_name && r.txt_value)
        .map((r) => ({
          type: "TXT",
          name: r.txt_name!,
          value: r.txt_value!,
        }));
    }

    return {
      status: result.status,
      sslStatus: result.ssl?.status || "initializing",
      ownershipVerified: result.status === "active",
      sslActive: result.ssl?.status === "active",
      verificationRecords,
      verificationErrors: result.verification_errors || [],
    };
  }

  /**
   * Remove a custom hostname from Cloudflare.
   */
  async removeCustomHostname(hostnameId: string): Promise<void> {
    logger.info(`[Cloudflare] Removing custom hostname: ${hostnameId}`);

    await this.request<{ id: string }>(
      "DELETE",
      `/zones/${this.zoneId}/custom_hostnames/${hostnameId}`
    );

    logger.info(`[Cloudflare] Hostname removed: ${hostnameId}`);
  }

  /**
   * Trigger a re-verification / refresh for a custom hostname.
   * Useful when a tenant has fixed their DNS records and wants to retry.
   */
  async refreshVerification(hostnameId: string): Promise<CloudflareHostnameStatus> {
    logger.info(`[Cloudflare] Refreshing verification for hostname: ${hostnameId}`);

    const result = await this.request<{
      id: string;
      hostname: string;
      status: string;
      ssl: {
        status: string;
        validation_records?: Array<{
          txt_name?: string;
          txt_value?: string;
          cname?: string;
          cname_target?: string;
        }>;
      };
      ownership_verification?: {
        type: string;
        name: string;
        value: string;
      };
      verification_errors?: string[];
    }>("PATCH", `/zones/${this.zoneId}/custom_hostnames/${hostnameId}`, {
      ssl: {
        method: "http",
        type: "dv",
      },
    });

    const verificationRecords: CloudflareVerificationRecords = {};

    if (result.ownership_verification) {
      verificationRecords.ownershipVerification = {
        type: result.ownership_verification.type,
        name: result.ownership_verification.name,
        value: result.ownership_verification.value,
      };
    }

    if (result.ssl?.validation_records) {
      verificationRecords.sslValidation = result.ssl.validation_records
        .filter((r) => r.txt_name && r.txt_value)
        .map((r) => ({
          type: "TXT",
          name: r.txt_name!,
          value: r.txt_value!,
        }));
    }

    return {
      status: result.status,
      sslStatus: result.ssl?.status || "initializing",
      ownershipVerified: result.status === "active",
      sslActive: result.ssl?.status === "active",
      verificationRecords,
      verificationErrors: result.verification_errors || [],
    };
  }

  /**
   * Returns the CNAME target that tenants should point their custom domain to.
   */
  getCnameTarget(): string {
    return this.cnameTarget;
  }
}

export default new CloudflareDomainService();
