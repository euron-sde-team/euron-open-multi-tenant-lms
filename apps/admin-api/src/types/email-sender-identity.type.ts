/**
 * Email Engine, sender identity types
 * ============================================================================
 *
 * A sender identity is a single FROM address (e.g. `noreply@hello.example.org`)
 * with an optional display name (e.g. "Acme Academy"). It MUST live on a
 * VERIFIED sending domain owned by the tenant.
 *
 * Each tenant may flag at most ONE identity per category as the default:
 *   - transactional (OTP, password reset, invoices)
 *   - notification (course updates, mentions)
 *   - marketing (campaigns)
 *
 * The resolver (Phase 6) picks the per-category default at send time. If a
 * tenant has no identity flagged as default for a category, the resolver
 * returns { mode: "legacy" } even if a verified domain exists, so the legacy
 * FROM line `"{tenantName} <{config.legacyFromEmail}>"` keeps the send
 * flowing rather than throwing an error.
 *
 * Delete semantics:
 *   - Tenant-initiated delete = soft-archive (status = ARCHIVED). Historical
 *     `tenant_email_messages.sender_identity_id` FKs stay intact so audit /
 *     reputation queries can still resolve the sender.
 *   - Domain-initiated delete = hard cascade (FK onDelete: Cascade on schema).
 *     Historical messages keep their FK via SetNull on the messages table.
 * ============================================================================
 */

export type SenderIdentityCategory =
  | "transactional"
  | "notification"
  | "marketing";

export interface CreateSenderIdentityInput {
  emailAddress: string;
  displayName?: string | null;
  replyTo?: string | null;
  isDefaultTransactional?: boolean;
  isDefaultNotification?: boolean;
  isDefaultMarketing?: boolean;
}

export interface UpdateSenderIdentityInput {
  displayName?: string | null;
  replyTo?: string | null;
  isDefaultTransactional?: boolean;
  isDefaultNotification?: boolean;
  isDefaultMarketing?: boolean;
}

export interface SenderIdentityResponse {
  id: string;
  tenantId: string;
  sendingDomainId: string;
  emailAddress: string;
  displayName: string | null;
  replyTo: string | null;
  status: "ACTIVE" | "ARCHIVED";
  isDefaultTransactional: boolean;
  isDefaultNotification: boolean;
  isDefaultMarketing: boolean;
  createdAt: string;
  updatedAt: string;
}
