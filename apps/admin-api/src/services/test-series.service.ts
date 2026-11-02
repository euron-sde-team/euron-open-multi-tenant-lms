import { customAlphabet } from "nanoid";
import type { Transaction } from "kysely";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { db } from "../db/connection";
import type { DB } from "../db/types";
import contentPricesRepository from "../repositories/content-prices.repository";
import testSeriesRepository, {
  type TestSeriesRow,
  type TestSeriesTestRow,
  type CreateTestSeriesInput,
  type UpdateTestSeriesInput,
  type TestSeriesListParams,
} from "../repositories/test-series.repository";
import testsRepository from "../repositories/tests.repository";
import contentPricesService, { type ContentPriceDto } from "./content-prices.service";
import testEntitlementsService from "./test-entitlements.service";
import entitlementsService from "./entitlements.service";
import { requireSlug, uniqueSlug } from "../utils/slug";

const slugSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 4);
const MAX_FREE_PREVIEWS = 2;

const VALID_STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const VALID_VISIBILITIES = new Set(["PUBLIC", "UNLISTED", "PRIVATE"]);
const VALID_ACCESS_MODES = new Set(["SEQUENTIAL", "OPEN"]);
const VALID_PRICING = new Set(["FREE", "PAID"]);

export interface TestSeriesResponse {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageKey: string | null;
  category: string | null;
  pricingType: string;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  currency: string | null;
  validityDays: number | null;
  endDate: string | null;
  visibility: string;
  accessMode: string;
  status: string;
  createdBy: string | null;
  /** Multi-currency price book; attached on detail responses. */
  prices?: ContentPriceDto[];
  createdAt: string;
  updatedAt: string;
}

export interface TestSeriesTestResponse {
  id: string;
  testSeriesId: string;
  testId: string;
  orderIndex: number;
  isFreePreview: boolean;
}

function toSeriesResponse(row: TestSeriesRow): TestSeriesResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    coverImageKey: row.cover_image_key,
    category: row.category,
    pricingType: String(row.pricing_type),
    priceInr: row.price_inr ? String(row.price_inr) : null,
    priceUsd: row.price_usd ? String(row.price_usd) : null,
    discountInr: row.discount_inr != null ? String(row.discount_inr) : null,
    discountUsd: row.discount_usd != null ? String(row.discount_usd) : null,
    currency: (row.currency as unknown as string | null) ?? null,
    validityDays: row.validity_days,
    endDate: row.end_date instanceof Date ? row.end_date.toISOString() : (row.end_date as string | null),
    visibility: String(row.visibility),
    accessMode: String(row.access_mode),
    status: String(row.status),
    createdBy: row.created_by,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

function toSeriesTestResponse(row: TestSeriesTestRow): TestSeriesTestResponse {
  return {
    id: row.id,
    testSeriesId: row.test_series_id,
    testId: row.test_id,
    orderIndex: Number(row.order_index ?? 0),
    isFreePreview: Boolean(row.is_free_preview),
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

class TestSeriesService {
  async list(tenantId: string, params: TestSeriesListParams) {
    const result = await testSeriesRepository.findByTenantId(tenantId, params);
    return {
      // toSeriesResponse maps field-by-field, so bundles is added explicitly.
      series: result.series.map((row) => ({
        ...toSeriesResponse(row),
        bundles: row.bundles ?? [],
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async getById(tenantId: string, seriesId: string): Promise<TestSeriesResponse> {
    const row = await testSeriesRepository.findById(seriesId);
    if (!row) throw new NotFoundError("Test series not found");
    if (row.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this test series");
    const base = toSeriesResponse(row);
    base.prices = await contentPricesService.getEntityPrices(tenantId, "TEST_SERIES", seriesId);
    return base;
  }

  /**
   * Live usage snapshot for `testseries_count`. The counter system can drift
   * (older published series predate the consume hook, or counters never got
   * a row when the entitlement wasn't assigned). To avoid lying to the
   * admin, we count actually-PUBLISHED series straight from the table and
   * pair it with the entitlement-defined limit. Cheap query, accurate every
   * time.
   */
  async getEntitlementUsage(
    tenantId: string
  ): Promise<{
    productCode: "testseries_count";
    used: number;
    limit: number;
    isUnlimited: boolean;
    atCapacity: boolean;
  }> {
    const [used, capacity] = await Promise.all([
      testSeriesRepository.countPublishedByTenant(tenantId),
      entitlementsService.checkCapacity(tenantId, "testseries_count", 1),
    ]);
    const isUnlimited = Boolean(capacity.isUnlimited);
    const limit = Number(capacity.limit ?? 0);
    return {
      productCode: "testseries_count",
      used,
      limit,
      isUnlimited,
      atCapacity: !isUnlimited && used >= limit,
    };
  }

  async getBySlug(
    tenantId: string,
    slug: string
  ): Promise<TestSeriesResponse | null> {
    const row = await testSeriesRepository.findByTenantAndSlug(tenantId, slug);
    if (!row) return null;
    const base = toSeriesResponse(row);
    base.prices = await contentPricesService.getEntityPrices(tenantId, "TEST_SERIES", row.id);
    return base;
  }

  async create(
    tenantId: string,
    data: Omit<CreateTestSeriesInput, "tenant_id">,
    createdBy?: string
  ): Promise<TestSeriesResponse> {
    await testEntitlementsService.ensureTestSeriesEnabled(tenantId);

    if (!data.title?.trim()) throw new BadRequestError("Title is required");
    if (data.pricing_type && !VALID_PRICING.has(data.pricing_type))
      throw new BadRequestError("Invalid pricing_type");
    if (data.visibility && !VALID_VISIBILITIES.has(data.visibility))
      throw new BadRequestError("Invalid visibility");
    if (data.access_mode && !VALID_ACCESS_MODES.has(data.access_mode))
      throw new BadRequestError("Invalid access_mode");

    const { prices, ...createData } = data;
    // pricing_type doubles as the purchase mode; the schema default is FREE.
    const preparedPrices = await contentPricesService.prepareFromPayload(
      tenantId,
      "TEST_SERIES",
      prices,
      { purchaseMode: (createData.pricing_type as string) ?? "FREE" }
    );
    if (preparedPrices) {
      createData.price_inr = preparedPrices.legacy.price_inr;
      createData.price_usd = preparedPrices.legacy.price_usd;
      createData.discount_inr = preparedPrices.legacy.discount_inr;
      createData.discount_usd = preparedPrices.legacy.discount_usd;
    }
    // Legacy-only writers must still carry a price; a prices payload is
    // validated by contentPricesService against the store default currency.
    if (
      !preparedPrices &&
      data.pricing_type === "PAID" &&
      !data.price_inr &&
      !data.price_usd
    ) {
      throw new BadRequestError("Paid series must have a price (INR or USD)");
    }

    let slug = data.slug?.trim() ? slugify(data.slug) : slugify(data.title);
    if (!slug) slug = `series-${slugSuffix()}`;

    const row = await db.transaction().execute(async (trx) => {
      const taken = await testSeriesRepository.slugExistsForTenant(
        tenantId,
        slug,
        undefined,
        trx
      );
      if (taken) slug = `${slug}-${slugSuffix()}`;

      const created = await testSeriesRepository.create(
        {
          ...createData,
          tenant_id: tenantId,
          title: data.title.trim(),
          slug,
          created_by: createdBy ?? data.created_by ?? null,
        },
        trx
      );

      if (preparedPrices) {
        await contentPricesService.applyPrepared(
          tenantId,
          "TEST_SERIES",
          created.id,
          preparedPrices,
          trx
        );
      } else {
        await contentPricesService.syncFromLegacyColumns(
          tenantId,
          "TEST_SERIES",
          created.id,
          {
            price_inr: createData.price_inr,
            price_usd: createData.price_usd,
            discount_inr: createData.discount_inr,
            discount_usd: createData.discount_usd,
          },
          trx
        );
      }

      return created;
    });
    return toSeriesResponse(row);
  }

  async update(
    tenantId: string,
    seriesId: string,
    data: UpdateTestSeriesInput
  ): Promise<TestSeriesResponse> {
    const existing = await testSeriesRepository.findById(seriesId);
    if (!existing) throw new NotFoundError("Test series not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this test series");

    if (data.title !== undefined && !data.title.trim())
      throw new BadRequestError("Title cannot be empty");
    if (data.pricing_type && !VALID_PRICING.has(data.pricing_type))
      throw new BadRequestError("Invalid pricing_type");
    if (data.visibility && !VALID_VISIBILITIES.has(data.visibility))
      throw new BadRequestError("Invalid visibility");
    if (data.access_mode && !VALID_ACCESS_MODES.has(data.access_mode))
      throw new BadRequestError("Invalid access_mode");
    if (data.status !== undefined && !VALID_STATUSES.has(data.status))
      throw new BadRequestError("Invalid status");

    const { prices, ...rest } = data;

    // end_date arrives from the client as an ISO string; the repo stores a Date.
    if (rest.end_date !== undefined && rest.end_date !== null) {
      rest.end_date = new Date(rest.end_date as unknown as string);
    }

    const effectivePricingType =
      (data.pricing_type as string | undefined) ?? String(existing.pricing_type ?? "FREE");
    const preparedPrices = await contentPricesService.prepareFromPayload(
      tenantId,
      "TEST_SERIES",
      prices,
      { purchaseMode: effectivePricingType }
    );
    if (preparedPrices) {
      rest.price_inr = preparedPrices.legacy.price_inr;
      rest.price_usd = preparedPrices.legacy.price_usd;
      rest.discount_inr = preparedPrices.legacy.discount_inr;
      rest.discount_usd = preparedPrices.legacy.discount_usd;
    }
    const legacyPriceTouched =
      !preparedPrices &&
      (rest.price_inr !== undefined ||
        rest.price_usd !== undefined ||
        rest.discount_inr !== undefined ||
        rest.discount_usd !== undefined);
    const syncPrices = async (trx: Transaction<DB>) => {
      if (preparedPrices) {
        await contentPricesService.applyPrepared(
          tenantId,
          "TEST_SERIES",
          seriesId,
          preparedPrices,
          trx
        );
      } else if (legacyPriceTouched) {
        await contentPricesService.syncFromLegacyColumns(
          tenantId,
          "TEST_SERIES",
          seriesId,
          {
            price_inr: rest.price_inr,
            price_usd: rest.price_usd,
            discount_inr: rest.discount_inr,
            discount_usd: rest.discount_usd,
          },
          trx
        );
      }
    };

    const row = await db.transaction().execute(async (trx) => {
      let nextSlug: string | undefined;
      if (data.slug !== undefined) {
        // The shared rule (100 characters), the same as the admin's, so a slug
        // the admin sees is the slug that is stored.
        nextSlug = requireSlug(data.slug);
        if (nextSlug !== existing.slug) {
          // Taken by another series in the tenant: add a short code rather
          // than refuse. Otherwise the slug is kept as asked.
          nextSlug = await uniqueSlug(nextSlug, (candidate) =>
            testSeriesRepository.slugExistsForTenant(tenantId, candidate, seriesId, trx)
          );
        }
      }
      const updated = await testSeriesRepository.update(
        seriesId,
        tenantId,
        { ...rest, slug: nextSlug, title: rest.title?.trim() },
        trx
      );
      if (!updated) throw new NotFoundError("Test series not found");
      await syncPrices(trx);
      return updated;
    });
    return toSeriesResponse(row);
  }

  async delete(tenantId: string, seriesId: string): Promise<void> {
    const existing = await testSeriesRepository.findById(seriesId);
    if (!existing) throw new NotFoundError("Test series not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this test series");

    const wasPublished = String(existing.status) === "PUBLISHED";
    await db.transaction().execute(async (trx) => {
      await contentPricesRepository.deleteByEntity(tenantId, "TEST_SERIES", seriesId, trx);
      const ok = await testSeriesRepository.delete(seriesId, tenantId, trx);
      if (!ok) throw new NotFoundError("Test series not found");
    });
    if (wasPublished) {
      await testEntitlementsService.releaseSeries(tenantId, 1);
    }
  }

  async publish(tenantId: string, seriesId: string): Promise<TestSeriesResponse> {
    const existing = await testSeriesRepository.findById(seriesId);
    if (!existing) throw new NotFoundError("Test series not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this test series");
    if (String(existing.status) === "PUBLISHED") {
      return toSeriesResponse(existing);
    }

    // Validate at least one published test attached
    const seriesTests = await testSeriesRepository.findTestsBySeries(seriesId, tenantId);
    if (seriesTests.length === 0)
      throw new BadRequestError("Cannot publish: series has no tests");
    const testIds = seriesTests.map((st) => st.test_id);
    const tests = await Promise.all(
      testIds.map((id) => testsRepository.findById(id, tenantId))
    );
    const allPublished = tests.every((t) => t && String(t.status) === "PUBLISHED");
    if (!allPublished) {
      throw new BadRequestError(
        "Cannot publish: all tests in this series must be published first"
      );
    }

    await testEntitlementsService.ensureCanPublishSeries(tenantId);
    const row = await testSeriesRepository.update(seriesId, tenantId, {
      status: "PUBLISHED",
    });
    if (!row) throw new NotFoundError("Test series not found");
    await testEntitlementsService.consumeSeries(tenantId, 1);
    return toSeriesResponse(row);
  }

  async unpublish(tenantId: string, seriesId: string): Promise<TestSeriesResponse> {
    const existing = await testSeriesRepository.findById(seriesId);
    if (!existing) throw new NotFoundError("Test series not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this test series");
    if (String(existing.status) !== "PUBLISHED") {
      return toSeriesResponse(existing);
    }
    const row = await testSeriesRepository.update(seriesId, tenantId, {
      status: "DRAFT",
    });
    if (!row) throw new NotFoundError("Test series not found");
    await testEntitlementsService.releaseSeries(tenantId, 1);
    return toSeriesResponse(row);
  }

  // ---------- Series-Tests linking ----------
  async listSeriesTests(
    tenantId: string,
    seriesId: string
  ): Promise<TestSeriesTestResponse[]> {
    await this.getById(tenantId, seriesId);
    const rows = await testSeriesRepository.findTestsBySeries(seriesId, tenantId);
    return rows.map(toSeriesTestResponse);
  }

  async addTestToSeries(
    tenantId: string,
    seriesId: string,
    body: { test_id: string; order_index?: number; is_free_preview?: boolean }
  ): Promise<TestSeriesTestResponse> {
    await this.getById(tenantId, seriesId);
    const test = await testsRepository.findById(body.test_id, tenantId);
    if (!test) throw new NotFoundError("Test not found");

    if (body.is_free_preview) {
      const previewCount = await testSeriesRepository.countFreePreviews(
        seriesId,
        tenantId
      );
      if (previewCount >= MAX_FREE_PREVIEWS) {
        throw new BadRequestError(
          `A series can have at most ${MAX_FREE_PREVIEWS} free preview tests`
        );
      }
    }

    const row = await testSeriesRepository.addTestToSeries({
      tenant_id: tenantId,
      test_series_id: seriesId,
      test_id: body.test_id,
      order_index: body.order_index,
      is_free_preview: body.is_free_preview,
    });
    return toSeriesTestResponse(row);
  }

  async removeTestFromSeries(
    tenantId: string,
    seriesId: string,
    testId: string
  ): Promise<void> {
    await this.getById(tenantId, seriesId);
    const ok = await testSeriesRepository.removeTestFromSeries(
      seriesId,
      testId,
      tenantId
    );
    if (!ok) throw new NotFoundError("Test not in series");
  }

  async reorderSeriesTests(
    tenantId: string,
    seriesId: string,
    orderedTestIds: string[]
  ): Promise<{ reordered: number }> {
    await this.getById(tenantId, seriesId);
    await db.transaction().execute(async (trx) => {
      await testSeriesRepository.reorderTestsInSeries(
        seriesId,
        tenantId,
        orderedTestIds,
        trx
      );
    });
    return { reordered: orderedTestIds.length };
  }

}

export default new TestSeriesService();
