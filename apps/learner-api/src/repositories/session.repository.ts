import { db } from "../db/connection";

class SessionRepository {
  async create(data: {
    id: string;
    tenant_id: string;
    member_id: string;
    session_token: string;
    device_info?: string;
  }): Promise<void> {
    const now = new Date();
    await db
      .insertInto("tenant_member_sessions")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        member_id: data.member_id,
        session_token: data.session_token,
        device_info: data.device_info ?? null,
        is_active: true,
        created_at: now,
        last_seen_at: now,
      })
      .execute();
  }

  async deactivateAllForMember(tenantId: string, memberId: string): Promise<void> {
    await db
      .updateTable("tenant_member_sessions")
      .set({ is_active: false })
      .where("tenant_id", "=", tenantId)
      .where("member_id", "=", memberId)
      .where("is_active", "=", true)
      .execute();
  }

  /**
   * Session lookup, joined to the member so callers get the account status in
   * the SAME round trip.
   *
   * This runs on every authenticated request (auth.middleware), so the join is
   * load-bearing for cost: reading `tenant_members.status` here is what lets an
   * admin's suspension take effect on the learner's next request without adding
   * a second query, a cache, or an invalidation bus. `tenant_members.id` is the
   * primary key and the session row is found by its unique `session_token`
   * index, so the join is a single index lookup.
   */
  async findBySessionToken(token: string): Promise<{
    id: string;
    tenant_id: string;
    member_id: string;
    is_active: boolean;
    member_status: string;
  } | undefined> {
    return db
      .selectFrom("tenant_member_sessions as s")
      .innerJoin("tenant_members as m", "m.id", "s.member_id")
      .select([
        "s.id",
        "s.tenant_id",
        "s.member_id",
        "s.is_active",
        "m.status as member_status",
      ])
      .where("s.session_token", "=", token)
      .executeTakeFirst();
  }

  async updateLastSeen(token: string): Promise<void> {
    await db
      .updateTable("tenant_member_sessions")
      .set({ last_seen_at: new Date() })
      .where("session_token", "=", token)
      .execute();
  }

  async deactivateByToken(token: string): Promise<void> {
    await db
      .updateTable("tenant_member_sessions")
      .set({ is_active: false })
      .where("session_token", "=", token)
      .execute();
  }
}

export default new SessionRepository();
