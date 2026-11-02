/**
 * Email Engine, sender identity service
 * ============================================================================
 *
 * CRUD for per-tenant FROM addresses. The resolver (Phase 6) reads default
 * identities for each category at send time.
 *
 * Invariants enforced here:
 *   1. Identity's email_address local-part is well-formed; domain part MUST
 *      match a VERIFIED `tenant_email_sending_domains.subdomain` owned by
 *      this tenant. Identities cannot point at unverified or failed domains.
 *   2. At most ONE default per category per tenant. Promoting a new default
 *      automatically demotes the previous one; both operations happen in a
 *      single DB transaction so concurrent admin clicks cannot leave the
 *      tenant with two defaults for the same category.
 *   3. Defaults can only be set when the parent domain is VERIFIED. Setting
 *      a default on a PENDING/FAILED domain throws BadRequestError.
 *   4. Soft delete only. Tenant-initiated delete sets status = ARCHIVED;
 *      historical `tenant_email_messages.sender_identity_id` FKs stay valid
 *      so reputation queries can still resolve who sent a given message.
 *      A default-bearing identity cannot be archived without first demoting
 *      it (otherwise the tenant would lose their MARKETING / NOTIFICATION
 *      / TRANSACTIONAL default and quietly fall through to the legacy path).
 *   5. Hard delete only happens when the parent domain is deleted. Cascade
 *      runs against tenant_email_sender_identities; historical messages
 *      retain audit via `tenant_email_messages.sender_identity_id` SetNull.
 * ============================================================================
 */

import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { NotFoundError } from "../errors/not-found.error";
import emailSenderIdentityRepository, {
  type SenderIdentityRow,
} from "../repositories/email-sender-identity.repository";
import emailSendingDomainRepository from "../repositories/email-sending-domain.repository";
import type {
  CreateSenderIdentityInput,
  SenderIdentityResponse,
  UpdateSenderIdentityInput,
} from "../types/email-sender-identity.type";
import { invalidate as invalidateResolverCache } from "./email-engine/resolver";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

// Local part: alphanumeric + . _ - + (RFC 5321-ish; covers what tenants will
// realistically use as a noreply / support / billing / hello mailbox).
const LOCAL_PART_REGEX = /^[a-zA-Z0-9._+-]{1,64}$/;
const DISPLAY_NAME_MAX = 255;

function parseAndValidateAddress(raw: string): {
  local: string;
  domain: string;
  normalized: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new BadRequestError("emailAddress is required");
  }
  if (trimmed.length > 320) {
    throw new BadRequestError("emailAddress must be 320 characters or fewer");
  }
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    throw new BadRequestError(
      "emailAddress must be in the form `local@subdomain.example.com`",
    );
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (!LOCAL_PART_REGEX.test(local)) {
    throw new BadRequestError(
      "emailAddress local part may only contain letters, digits, dot, underscore, hyphen, plus",
    );
  }
  return { local, domain, normalized: `${local}@${domain}` };
}

function validateDisplayName(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > DISPLAY_NAME_MAX) {
    throw new BadRequestError(
      `displayName must be ${DISPLAY_NAME_MAX} characters or fewer`,
    );
  }
  return trimmed;
}

function validateReplyTo(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // Reply-To can be any valid email; reuse the parser as a format check but
  // do NOT require it to live on the tenant's sending domain (a tenant may
  // legitimately want replies routed to their support@ inbox on a different
  // domain).
  parseAndValidateAddress(trimmed);
  return trimmed;
}

function toResponse(row: SenderIdentityRow): SenderIdentityResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sendingDomainId: row.sending_domain_id,
    emailAddress: row.email_address,
    displayName: row.display_name,
    replyTo: row.reply_to,
    status: row.status,
    isDefaultTransactional: row.is_default_transactional,
    isDefaultNotification: row.is_default_notification,
    isDefaultMarketing: row.is_default_marketing,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class EmailSenderIdentityService {
  async create(
    tenantId: string,
    input: CreateSenderIdentityInput,
  ): Promise<SenderIdentityResponse> {
    const { normalized, domain } = parseAndValidateAddress(input.emailAddress);
    const displayName = validateDisplayName(input.displayName);
    const replyTo = validateReplyTo(input.replyTo);

    // Domain must exist + be VERIFIED. Looking up by subdomain is the natural
    // key here; the FK we persist is the row id.
    const sendingDomain =
      await emailSendingDomainRepository.findByTenantAndSubdomain(
        tenantId,
        domain,
      );
    if (!sendingDomain) {
      throw new BadRequestError(
        `No sending domain "${domain}" is registered for this tenant. Onboard the domain first via POST /tenant/email-sending-domains.`,
      );
    }
    if (sendingDomain.status !== "VERIFIED") {
      throw new BadRequestError(
        `Sending domain "${domain}" is not VERIFIED yet (status: ${sendingDomain.status}). Publish DNS records and wait for verification before creating sender identities on it.`,
      );
    }

    // Reject duplicate (tenant_id, email_address) early with a clear error.
    const dup = await emailSenderIdentityRepository.findByTenantAndEmail(
      tenantId,
      normalized,
    );
    if (dup) {
      throw new ConflictError(
        `A sender identity for "${normalized}" already exists. PATCH it instead, or DELETE the existing one first.`,
      );
    }

    const isDefaultTransactional = input.isDefaultTransactional === true;
    const isDefaultNotification = input.isDefaultNotification === true;
    const isDefaultMarketing = input.isDefaultMarketing === true;

    const created = await db.transaction().execute(async (trx) => {
      // Step 1: demote any prior defaults for categories this identity will claim.
      if (isDefaultTransactional) {
        await emailSenderIdentityRepository.clearCategoryDefaultExcept(
          tenantId,
          "is_default_transactional",
          null,
          trx,
        );
      }
      if (isDefaultNotification) {
        await emailSenderIdentityRepository.clearCategoryDefaultExcept(
          tenantId,
          "is_default_notification",
          null,
          trx,
        );
      }
      if (isDefaultMarketing) {
        await emailSenderIdentityRepository.clearCategoryDefaultExcept(
          tenantId,
          "is_default_marketing",
          null,
          trx,
        );
      }
      // Step 2: insert.
      return emailSenderIdentityRepository.create(
        {
          tenantId,
          sendingDomainId: sendingDomain.id,
          emailAddress: normalized,
          displayName,
          replyTo,
          isDefaultTransactional,
          isDefaultNotification,
          isDefaultMarketing,
        },
        trx,
      );
    });

    await invalidateResolverCache(tenantId);
    return toResponse(created);
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateSenderIdentityInput,
  ): Promise<SenderIdentityResponse> {
    const existing = await emailSenderIdentityRepository.findByTenantAndId(
      tenantId,
      id,
    );
    if (!existing) throw new NotFoundError("Sender identity not found");
    if (existing.status === "ARCHIVED") {
      throw new BadRequestError(
        "Cannot update an archived sender identity. Create a new one instead.",
      );
    }

    const settingAnyDefault =
      input.isDefaultTransactional === true ||
      input.isDefaultNotification === true ||
      input.isDefaultMarketing === true;

    if (settingAnyDefault) {
      // Verify the parent domain is still VERIFIED before allowing this
      // identity to be promoted to any default slot.
      const sendingDomain =
        await emailSendingDomainRepository.findByTenantAndId(
          tenantId,
          existing.sending_domain_id,
        );
      if (!sendingDomain || sendingDomain.status !== "VERIFIED") {
        throw new BadRequestError(
          "Cannot mark this identity as default; its sending domain is not VERIFIED.",
        );
      }
    }

    const patch: UpdateSenderIdentityInput & { displayName?: string | null } = {
      ...input,
      displayName:
        input.displayName !== undefined
          ? validateDisplayName(input.displayName)
          : undefined,
      replyTo:
        input.replyTo !== undefined ? validateReplyTo(input.replyTo) : undefined,
    };

    const updated = await db.transaction().execute(async (trx) => {
      if (patch.isDefaultTransactional === true) {
        await emailSenderIdentityRepository.clearCategoryDefaultExcept(
          tenantId,
          "is_default_transactional",
          id,
          trx,
        );
      }
      if (patch.isDefaultNotification === true) {
        await emailSenderIdentityRepository.clearCategoryDefaultExcept(
          tenantId,
          "is_default_notification",
          id,
          trx,
        );
      }
      if (patch.isDefaultMarketing === true) {
        await emailSenderIdentityRepository.clearCategoryDefaultExcept(
          tenantId,
          "is_default_marketing",
          id,
          trx,
        );
      }
      return emailSenderIdentityRepository.update(tenantId, id, patch, trx);
    });

    await invalidateResolverCache(tenantId);
    return toResponse(updated);
  }

  async listForTenant(tenantId: string): Promise<SenderIdentityResponse[]> {
    const rows = await emailSenderIdentityRepository.listByTenant(tenantId);
    return rows.map(toResponse);
  }

  async getById(
    tenantId: string,
    id: string,
  ): Promise<SenderIdentityResponse> {
    const row = await emailSenderIdentityRepository.findByTenantAndId(
      tenantId,
      id,
    );
    if (!row) throw new NotFoundError("Sender identity not found");
    return toResponse(row);
  }

  /**
   * Soft delete: status -> ARCHIVED. Refuses if the identity is currently
   * default for any category (the tenant must promote a replacement first).
   */
  async archiveById(tenantId: string, id: string): Promise<void> {
    const existing = await emailSenderIdentityRepository.findByTenantAndId(
      tenantId,
      id,
    );
    if (!existing) throw new NotFoundError("Sender identity not found");
    if (existing.status === "ARCHIVED") return;

    if (
      existing.is_default_transactional ||
      existing.is_default_notification ||
      existing.is_default_marketing
    ) {
      throw new ConflictError(
        "Cannot archive an identity that is the default for one or more categories. Promote a replacement first via PATCH on another identity, then archive this one.",
      );
    }

    await emailSenderIdentityRepository.update(tenantId, id, {
      status: "ARCHIVED",
    });
    await invalidateResolverCache(tenantId);
  }
}

export default new EmailSenderIdentityService();
