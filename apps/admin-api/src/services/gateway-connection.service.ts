/* eslint-disable @typescript-eslint/no-explicit-any */
import { ulid } from "ulid";
import config from "../config";
import logger from "../utils/logger";
import { db } from "../db/connection";
import { gateway_connection_status } from "../db/enums";
import * as billingProvidersRepo from "../repositories/billing-providers.repository";
import tenantGatewayConnectionsRepository from "../repositories/tenant-gateway-connections.repository";
import { encryptCredentials } from "../utils/credential-encryption";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";

import type {
  CreateGatewayConnectionRequest,
  CredentialFieldSchema,
  GatewayConnectionResponse,
  UpdateGatewayConnectionRequest,
  BillingProviderOption,
} from "../types/gateway-connection.type";

/**
 * Parse the credential_schema JSON from the database into a typed array.
 * Returns null if the column is null or not a valid array.
 */
function parseCredentialSchema(raw: unknown): CredentialFieldSchema[] | null {
  if (!raw) return null;
  if (!Array.isArray(raw)) return null;
  return raw as CredentialFieldSchema[];
}

/**
 * Validate submitted credentials against the provider's credential_schema.
 * Checks that all required fields are present and non-empty.
 */
function validateCredentialsAgainstSchema(
  schema: CredentialFieldSchema[] | null,
  credentials: Record<string, string> | null
): void {
  if (!schema || schema.length === 0) {
    if (!credentials || Object.keys(credentials).length === 0) {
      throw new BadRequestError(
        "SELF_MANAGED connections require credentials"
      );
    }
    return;
  }

  if (!credentials) {
    const requiredFields = schema.filter((f) => f.required);
    if (requiredFields.length > 0) {
      throw new BadRequestError(
        `Missing required credential fields: ${requiredFields.map((f) => f.label).join(", ")}`
      );
    }
    return;
  }

  const missing: string[] = [];
  for (const field of schema) {
    if (field.required) {
      const value = credentials[field.key];
      if (!value || !value.trim()) {
        missing.push(field.label);
      }
    }
  }
  if (missing.length > 0) {
    throw new BadRequestError(
      `Missing required credential fields: ${missing.join(", ")}`
    );
  }
}

function toResponse(
  row: Awaited<ReturnType<typeof tenantGatewayConnectionsRepository.findById>>,
  providerName: string
): GatewayConnectionResponse | null {
  if (!row) return null;
  const credentialsConfigured = Boolean(
    row.credentials_encrypted &&
      typeof row.credentials_encrypted === "object" &&
      Object.keys(row.credentials_encrypted as object).length > 0
  );
  const connectedAt = row.connected_at as unknown as Date | string | null | undefined;
  const createdAt = row.created_at as unknown as Date | string;
  const updatedAt = row.updated_at as unknown as Date | string;
  const toIso = (d: Date | string | null | undefined): string | null =>
    d == null ? null : (d instanceof Date ? d : new Date(d)).toISOString();
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    provider_id: row.provider_id,
    provider_name: providerName,
    mode: row.mode,
    label: row.label,
    credentials_configured: credentialsConfigured,
    platform_commission_pct: row.platform_commission_pct
      ? Number(row.platform_commission_pct)
      : null,
    platform_commission_flat: row.platform_commission_flat
      ? Number(row.platform_commission_flat)
      : null,
    is_active: Boolean(row.is_active),
    is_verified: Boolean(row.is_verified),
    connected_at: toIso(connectedAt),
    status: row.status as unknown as GatewayConnectionResponse["status"],
    created_at: toIso(createdAt) ?? "",
    updated_at: toIso(updatedAt) ?? "",
  };
}

/** Tenant checkout gateways this platform supports. */
const SUPPORTED_GATEWAYS = new Set(["RAZORPAY", "STRIPE"]);

class GatewayConnectionService {
  /**
   * Verify Razorpay credentials with a lightweight authenticated call.
   * Base URL from RAZORPAY_API_BASE so the local stub can stand in.
   */
  private async verifyRazorpayCredentials(keyId: string, keySecret: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${config.RAZORPAY_API_BASE}/v1/plans?count=1`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        },
      });
    } catch (err: any) {
      logger.error(`Razorpay verification network error: ${err?.message ?? "Unknown"}`);
      throw new BadRequestError("Failed to reach Razorpay. Please try again.");
    }
    if (response.status === 401 || response.status === 400) {
      throw new BadRequestError("Invalid Razorpay credentials. Please check your key_id and key_secret.");
    }
    if (!response.ok) {
      logger.error(`Razorpay verification failed (HTTP ${response.status})`);
      throw new BadRequestError("Failed to verify payment credentials. Please try again.");
    }
  }

  /**
   * Verify Stripe credentials with GET /v1/balance.
   *
   * Chosen because it is read-only, always available on every account, and needs
   * no ids to exist - so a brand-new account with no payments still verifies.
   * Stripe answers a bad key with a clean 401, so there is no
   * ambiguity to tolerate here.
   *
   * The webhook secret cannot be checked this way (Stripe exposes no endpoint for
   * it), so a typo there surfaces only when the first webhook fails signature
   * verification. That is why the seeded credential schema marks it required.
   */
  private async verifyStripeCredentials(secretKey: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${config.STRIPE_API_BASE}/v1/balance`, {
        method: "GET",
        headers: { Authorization: `Bearer ${secretKey}` },
      });
    } catch (err: any) {
      logger.error(`Stripe verification network error: ${err?.message ?? "Unknown"}`);
      throw new BadRequestError("Failed to reach Stripe. Please try again.");
    }

    if (response.status === 401) {
      throw new BadRequestError("Invalid Stripe secret key. Please check it and try again.");
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.error(`Stripe verification failed (HTTP ${response.status}): ${body.slice(0, 300)}`);
      throw new BadRequestError("Could not verify the Stripe key. Please try again.");
    }
  }

  /**
   * Run the provider-specific credential check, if there is one.
   *
   * Extracted so the create and update paths cannot drift: they previously held
   * two copies of the same if/else chain, and a provider added to one but not the
   * other would silently save unverified credentials.
   *
   * Returns whether the credentials were actually proven. False means "no check
   * exists for this provider", not "the check failed" - a real failure throws.
   */
  private async verifyCredentialsForProvider(
    providerName: string,
    creds: Record<string, string | undefined>
  ): Promise<boolean> {
    if (providerName === "RAZORPAY" && creds.key_id && creds.key_secret) {
      await this.verifyRazorpayCredentials(creds.key_id, creds.key_secret);
      return true;
    }
    if (providerName === "STRIPE" && creds.secret_key) {
      await this.verifyStripeCredentials(creds.secret_key);
      return true;
    }
    return false;
  }

  async listProviders(): Promise<BillingProviderOption[]> {
    const rows = (await billingProvidersRepo.findVisibleProviders()).filter((r) =>
      SUPPORTED_GATEWAYS.has(r.name.toUpperCase())
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      credential_schema: parseCredentialSchema(r.credential_schema),
    }));
  }

  async listConnections(tenantId: string): Promise<GatewayConnectionResponse[]> {
    const rows = await tenantGatewayConnectionsRepository.findAllByTenantId(tenantId);
    const result: GatewayConnectionResponse[] = [];
    for (const row of rows) {
      const provider = await billingProvidersRepo.findProviderById(row.provider_id);
      result.push(
        toResponse(row, provider?.name ?? "Unknown")!
      );
    }
    return result;
  }

  async getConnection(id: string, tenantId: string): Promise<GatewayConnectionResponse> {
    const row = await tenantGatewayConnectionsRepository.findById(id, tenantId);
    if (!row) throw new NotFoundError("Gateway connection not found");
    const provider = await billingProvidersRepo.findProviderById(row.provider_id);
    const res = toResponse(row, provider?.name ?? "Unknown");
    if (!res) throw new NotFoundError("Gateway connection not found");
    return res;
  }

  async createConnection(
    tenantId: string,
    data: CreateGatewayConnectionRequest
  ): Promise<GatewayConnectionResponse> {
    const provider = await billingProvidersRepo.findProviderById(data.provider_id);
    if (!provider) throw new BadRequestError("Invalid provider");
    if (!provider.is_visible_to_tenant) {
      throw new BadRequestError("Provider is not available for tenant connections");
    }
    if (!SUPPORTED_GATEWAYS.has(provider.name.toUpperCase())) {
      throw new BadRequestError("Only Stripe and Razorpay are supported");
    }

    if (data.mode === "SELF_MANAGED") {
      const schema = parseCredentialSchema(provider.credential_schema);
      validateCredentialsAgainstSchema(schema, data.credentials ?? null);
    }

    const now = new Date();
    const isActive = data.is_active ?? true;

    // Verify credentials OUTSIDE the transaction (external HTTP call)
    let credentialsEncrypted: { cipher: string } | null = null;
    let isVerified = false;
    if (data.mode === "SELF_MANAGED" && data.credentials) {
      const providerName = provider.name.toUpperCase();
      const creds = data.credentials as Record<string, string | undefined>;
      isVerified = await this.verifyCredentialsForProvider(providerName, creds);
      const cipher = encryptCredentials(data.credentials as unknown as Record<string, unknown>);
      credentialsEncrypted = { cipher };
    }

    const createData = {
      id: ulid(),
      tenant_id: tenantId,
      provider_id: data.provider_id,
      mode: data.mode,
      label: data.label ?? null,
      credentials_encrypted: credentialsEncrypted,
      platform_commission_pct:
        data.platform_commission_pct != null
          ? String(data.platform_commission_pct)
          : null,
      platform_commission_flat:
        data.platform_commission_flat != null
          ? String(data.platform_commission_flat)
          : null,
      is_active: isActive,
      is_verified: isVerified,
      connected_at: isActive ? now : null,
      status: isActive ? gateway_connection_status.ACTIVE : gateway_connection_status.PENDING,
      created_at: now,
      updated_at: now,
    };

    // Wrap deactivate-all + create in a transaction for atomicity
    let row;
    if (isActive) {
      row = await db.transaction().execute(async (trx) => {
        await tenantGatewayConnectionsRepository.deactivateAllForTenant(tenantId, trx);
        return tenantGatewayConnectionsRepository.create(createData, trx);
      });
    } else {
      row = await tenantGatewayConnectionsRepository.create(createData);
    }

    return this.getConnection(row.id, tenantId);
  }

  async updateConnection(
    id: string,
    tenantId: string,
    data: UpdateGatewayConnectionRequest
  ): Promise<GatewayConnectionResponse> {
    const existing = await tenantGatewayConnectionsRepository.findById(id, tenantId);
    if (!existing) throw new NotFoundError("Gateway connection not found");

    const updates: Parameters<typeof tenantGatewayConnectionsRepository.update>[2] = {
      updated_at: new Date(),
    };

    if (data.mode !== undefined) updates.mode = data.mode;
    if (data.label !== undefined) updates.label = data.label;
    if (data.platform_commission_pct !== undefined) {
      updates.platform_commission_pct =
        data.platform_commission_pct != null ? String(data.platform_commission_pct) : null;
    }
    if (data.platform_commission_flat !== undefined) {
      updates.platform_commission_flat =
        data.platform_commission_flat != null ? String(data.platform_commission_flat) : null;
    }
    // #1: Server-side guard, prevent deactivating the active gateway directly
    if (data.is_active === false && existing.is_active) {
      throw new BadRequestError(
        "Cannot deactivate the only active gateway. Activate another gateway first."
      );
    }

    let shouldActivate = false;
    if (data.is_active !== undefined) {
      updates.is_active = data.is_active;
      if (data.is_active) {
        shouldActivate = true;
        updates.connected_at = new Date();
        (updates as { status?: string }).status = gateway_connection_status.ACTIVE;
      }
    }

    // #7: Validate SELF_MANAGED has credentials before activation
    if (shouldActivate && existing.mode === "SELF_MANAGED" && !data.credentials) {
      const hasCreds =
        existing.credentials_encrypted &&
        typeof existing.credentials_encrypted === "object" &&
        Object.keys(existing.credentials_encrypted as object).length > 0;
      if (!hasCreds) {
        throw new BadRequestError(
          "Cannot activate a self-managed gateway without credentials configured."
        );
      }
    }

    // Handle credentials, verify OUTSIDE the transaction (external HTTP call)
    if (data.credentials !== undefined) {
      if (existing.mode === "SELF_MANAGED" && data.credentials) {
        const provider = await billingProvidersRepo.findProviderById(existing.provider_id);
        const providerName = (provider?.name ?? "").toUpperCase();
        const creds = data.credentials as Record<string, string | undefined>;
        if (await this.verifyCredentialsForProvider(providerName, creds)) {
          (updates as { is_verified?: boolean }).is_verified = true;
        }
        const cipher = encryptCredentials(
          data.credentials as unknown as Record<string, unknown>
        );
        updates.credentials_encrypted = { cipher };
      } else {
        updates.credentials_encrypted = null;
        (updates as { is_verified?: boolean }).is_verified = false;
      }
    }

    type UpdatePayload = Parameters<typeof tenantGatewayConnectionsRepository.update>[2];
    if (shouldActivate) {
      // #11: Single-statement activation, atomically activates target + deactivates others
      await tenantGatewayConnectionsRepository.activateExclusive(id, tenantId);
      // Apply any non-activation updates (credentials, mode, label) separately
      const { is_active: _a, connected_at: _c, ...rest } = updates;
      delete (rest as { status?: string }).status;
      if (Object.keys(rest).length > 1) {
        await tenantGatewayConnectionsRepository.update(id, tenantId, rest as UpdatePayload);
      }
    } else {
      await tenantGatewayConnectionsRepository.update(id, tenantId, updates as UpdatePayload);
    }
    return this.getConnection(id, tenantId);
  }

  async deleteConnection(id: string, tenantId: string): Promise<void> {
    const existing = await tenantGatewayConnectionsRepository.findById(id, tenantId);
    if (!existing) throw new NotFoundError("Gateway connection not found");
    if (existing.is_active) {
      throw new BadRequestError(
        "Cannot delete the active gateway. Activate another gateway first."
      );
    }
    const deleted = await tenantGatewayConnectionsRepository.delete(id, tenantId);
    if (!deleted) throw new NotFoundError("Gateway connection not found");
  }
}

export default new GatewayConnectionService();
