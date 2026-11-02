import { db } from "../db/connection";
import logger from "../utils/logger";

export interface LoginEventInput {
  tenant_id?: string | null;
  principal_type: string;
  principal_id: string;
  email?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  timezone?: string | null;
  login_method?: string | null;
}

class LoginEventsRepository {
  /**
   * Record a login event. There is no login_events table in this schema, so
   * the event is written to the structured log. Never blocks auth.
   */
  async record(input: LoginEventInput): Promise<void> {
    logger.info("login_event", {
      tenant_id: input.tenant_id ?? null,
      principal_type: input.principal_type,
      principal_id: input.principal_id,
      login_method: input.login_method ?? null,
      country: input.country ?? null,
      device: input.device ?? null,
      browser: input.browser ?? null,
      os: input.os ?? null,
    });
  }

  /** Best-effort: the first active tenant a staff user belongs to. */
  async firstActiveTenantForUser(userId: string): Promise<string | null> {
    try {
      const row = await db
        .selectFrom("tenant_staff_memberships")
        .select("tenant_id")
        .where("user_id", "=", userId)
        .where("status", "=", "ACTIVE")
        .executeTakeFirst();
      return row?.tenant_id ?? null;
    } catch {
      return null;
    }
  }
}

export default new LoginEventsRepository();
