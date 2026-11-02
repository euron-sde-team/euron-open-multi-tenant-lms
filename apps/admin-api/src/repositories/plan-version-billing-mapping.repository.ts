import { db } from "../db/connection";
import type { billing_cycle } from "../db/enums";

interface PlanVersionBillingMappingRow {
  id: string;
  plan_version_id: string;
  billing_provider_id: string;
  billing_cycle: billing_cycle;
  currency: string;
  external_plan_id: string;
}

class PlanVersionBillingMappingRepository {
  async find(
    planVersionId: string,
    billingProviderId: string,
    billingCycle: billing_cycle,
    currency: string
  ): Promise<PlanVersionBillingMappingRow | null> {
    const row = await db
      .selectFrom("plan_version_billing_mappings")
      .selectAll()
      .where("plan_version_id", "=", planVersionId)
      .where("billing_provider_id", "=", billingProviderId)
      .where("billing_cycle", "=", billingCycle)
      .where("currency", "=", currency)
      .executeTakeFirst();
    return row as PlanVersionBillingMappingRow | null;
  }

  async upsert(data: {
    id?: string;
    plan_version_id: string;
    billing_provider_id: string;
    billing_cycle: billing_cycle;
    currency: string;
    external_plan_id: string;
  }): Promise<string> {
    const { ulid } = await import("ulid");
    const id = data.id ?? ulid();
    const now = new Date();

    const existing = await this.find(
      data.plan_version_id,
      data.billing_provider_id,
      data.billing_cycle,
      data.currency
    );
    if (existing) {
      return existing.external_plan_id;
    }

    try {
      await db
        .insertInto("plan_version_billing_mappings")
        .values({
          id,
          plan_version_id: data.plan_version_id,
          billing_provider_id: data.billing_provider_id,
          billing_cycle: data.billing_cycle,
          currency: data.currency,
          external_plan_id: data.external_plan_id,
          created_at: now,
          updated_at: now,
        })
        .execute();
      return data.external_plan_id;
    } catch (err: unknown) {
      // Race: another process inserted; return the existing one instead of updating
      const code = (err as { code?: string })?.code;
      if (code === "23505") {
        const raceExisting = await this.find(
          data.plan_version_id,
          data.billing_provider_id,
          data.billing_cycle,
          data.currency
        );
        if (raceExisting) {
          return raceExisting.external_plan_id;
        }
      }
      throw err;
    }
  }
}

const planVersionBillingMappingRepository = new PlanVersionBillingMappingRepository();
export default planVersionBillingMappingRepository;
