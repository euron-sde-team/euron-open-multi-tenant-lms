import { EntitlementForbiddenError } from "../errors/entitlement-forbidden.error";
import entitlementsService from "./entitlements.service";

const TEST_SERIES_ENABLED = "testseries_enabled";
const TEST_SERIES_COUNT = "testseries_count";

class TestEntitlementsService {
  async ensureTestSeriesEnabled(tenantId: string): Promise<void> {
    await entitlementsService.ensureBooleanEntitlement(
      tenantId,
      TEST_SERIES_ENABLED,
      "test_series",
      "Test series feature is not enabled on your plan"
    );
  }

  async ensureCanPublishSeries(tenantId: string): Promise<void> {
    await this.ensureTestSeriesEnabled(tenantId);
    const capacity = await entitlementsService.checkCapacity(
      tenantId,
      TEST_SERIES_COUNT,
      1
    );
    if (!capacity.allowed) {
      throw new EntitlementForbiddenError(
        "Test series limit reached. Upgrade your plan to publish more series.",
        {
          code: "ENTITLEMENT_LIMIT_REACHED",
          productCode: TEST_SERIES_COUNT,
          featureKey: "test_series",
          currentUsed: capacity.currentUsed,
          limit: capacity.limit,
          isUnlimited: capacity.isUnlimited,
        }
      );
    }
  }

  async consumeSeries(tenantId: string, amount = 1): Promise<void> {
    await entitlementsService.consume(tenantId, TEST_SERIES_COUNT, amount);
  }

  async releaseSeries(tenantId: string, amount = 1): Promise<void> {
    await entitlementsService.release(tenantId, TEST_SERIES_COUNT, amount);
  }
}

export default new TestEntitlementsService();
