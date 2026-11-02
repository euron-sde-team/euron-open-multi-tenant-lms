import crypto from "crypto";
import { ulid } from "ulid";
import sessionRepository from "../repositories/session.repository";
import { UnauthorizedError } from "../errors/unauthorized.error";
import { assertMemberActive } from "../utils/member-status.util";
import { db } from "../db/connection";

class SessionService {
  /**
   * Create a new session for a member. Deactivates all existing sessions first (single-device).
   */
  async createSession(tenantId: string, memberId: string, deviceInfo?: string): Promise<string> {
    const sessionToken = crypto.randomUUID();
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("tenant_member_sessions")
        .set({ is_active: false })
        .where("tenant_id", "=", tenantId)
        .where("member_id", "=", memberId)
        .where("is_active", "=", true)
        .execute();

      await trx
        .insertInto("tenant_member_sessions")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          member_id: memberId,
          session_token: sessionToken,
          device_info: deviceInfo ?? null,
          is_active: true,
          created_at: new Date(),
          last_seen_at: new Date(),
        })
        .execute();
    });
    return sessionToken;
  }

  /**
   * Validate a session token. Throws UnauthorizedError if invalid, inactive, or
   * if the member's account is no longer ACTIVE.
   *
   * The account-status check is what cuts off an already-signed-in learner the
   * moment a tenant admin suspends them: status comes back on the same query as
   * the session row, so this costs nothing for everyone else.
   */
  async validateSession(token: string): Promise<{ memberId: string; tenantId: string }> {
    const session = await sessionRepository.findBySessionToken(token);
    if (!session) {
      throw new UnauthorizedError("Session expired. Please log in again.");
    }

    // Account status is checked BEFORE session liveness, and the order matters:
    // suspending a member also revokes their sessions, so checking is_active
    // first would report the generic (code-less) "session expired" and the
    // learner would be logged out with no explanation. Status first means a
    // suspended member always learns why. An ACTIVE member whose session was
    // closed for an ordinary reason, logout, or a newer single-device login.
    // still falls through to "session expired" below.
    assertMemberActive(session.member_status);

    if (!session.is_active) {
      throw new UnauthorizedError("Session expired. Please log in again.");
    }
    return { memberId: session.member_id, tenantId: session.tenant_id };
  }

  /**
   * Invalidate a session (logout).
   */
  async invalidateSession(token: string): Promise<void> {
    await sessionRepository.deactivateByToken(token);
  }

  /**
   * Update last_seen_at, fire-and-forget, no await needed.
   */
  touchSession(token: string): void {
    sessionRepository.updateLastSeen(token).catch(() => {});
  }
}

export default new SessionService();
