import { db } from "../db/connection";

class TenantSubscriptionPlansRepository {
  async findActivePlansByTenantId(tenantId: string) {
    return db
      .selectFrom("tenant_subscription_plans")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("is_active", "=", true)
      .orderBy("created_at", "desc")
      .execute();
  }

  async findById(tenantId: string, planId: string) {
    return db
      .selectFrom("tenant_subscription_plans")
      .selectAll()
      .where("id", "=", planId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }
}

export default new TenantSubscriptionPlansRepository();
