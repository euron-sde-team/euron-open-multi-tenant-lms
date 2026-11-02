import { sql } from "kysely";
import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import {
  CatalogOrderConflictError,
  type CatalogOrderScope,
} from "../errors/catalog-order-conflict.error";
import { course_mode, course_type } from "../db/enums";

/**
 * ORDERED PRODUCTS, admin-defined catalog ordering.
 *
 * Tenant admins drag courses / batches / test series / books / bundles into
 * whatever sequence they want, and learners see exactly that. Not alphabetical,
 * not newest-first, whatever the admin arranged.
 *
 * `sort_order` (0-based, dense) holds the arrangement on each catalog table. It
 * already existed on courses/books/bundles/batches; test_series got it in
 * add_ordered_products.sql, which also seeded every table with the order that
 * was already on screen, so turning this on changes nothing until someone drags.
 *
 * THE MASTER SWITCH IS THE ONLY THING THAT GATES ENFORCEMENT.
 * OFF (the default for all 125 tenants) means lists sort the way they always
 * did. It does NOT mean the saved arrangement is discarded, flip it back on and
 * the order returns untouched. Same contract as sequential courses, for the same
 * reasons: "off but still enforced" strands admins with no UI to fix it, and
 * "off wipes the order" lets a misclick destroy real work with no undo.
 *
 * COURSES ARE ORDERED PER MODE. Self-paced, live and hybrid are browsed on
 * separate pages (/self-paced, /live, /hybrid), so each gets its own 0..N-1
 * run. One flat sequence across all modes would show gaps (2, 5, 9...) the
 * moment a page filters to a single mode.
 */

/** The catalog tables that can be ordered. */
const ORDERABLE = {
  courses: { table: "courses", scope: "courses" },
  books: { table: "books", scope: "books" },
  bundles: { table: "bundles", scope: "bundles" },
  batches: { table: "batches", scope: "batches" },
  test_series: { table: "test_series", scope: "test_series" },
} as const;

export type OrderableEntity = keyof typeof ORDERABLE;

export interface OrderedProductsSettings {
  enabled: boolean;
  enabled_at: Date | null;
}

export interface ReorderResult {
  updated: number;
  items: Array<{ id: string; sort_order: number }>;
}

/** A row as the client must send it back: id + where it sits now. */
export interface OrderableRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  sort_order: number;
}

function isOrderable(entity: string): entity is OrderableEntity {
  return Object.prototype.hasOwnProperty.call(ORDERABLE, entity);
}

/**
 * Reject anything that isn't a known catalog table.
 *
 * The table name is interpolated into raw SQL below (Kysely can't type a
 * runtime-chosen table), so this check is what keeps that safe. It is a
 * whitelist lookup against a frozen literal map, never a cast, never a
 * passthrough of caller input.
 */
function resolveEntity(entity: string): {
  table: string;
  scope: CatalogOrderScope;
} {
  if (!isOrderable(entity)) {
    throw new BadRequestError(
      `Unknown catalog type "${entity}". Expected one of: ${Object.keys(ORDERABLE).join(", ")}`
    );
  }
  return ORDERABLE[entity];
}

/** Payload sanity: an array of non-empty, non-duplicate strings. */
function validateIdPayload(ids: unknown, scope: CatalogOrderScope): string[] {
  if (!Array.isArray(ids)) {
    throw new BadRequestError("item_ids must be an array");
  }
  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0) {
      throw new BadRequestError("item_ids must contain non-empty strings");
    }
  }
  const unique = new Set(ids as string[]);
  if (unique.size !== ids.length) {
    throw new CatalogOrderConflictError(
      "The same item appears twice in the requested order.",
      { code: "STALE_CATALOG", scope }
    );
  }
  return ids as string[];
}

/**
 * The proposed order must name EVERY sibling exactly once, no more, no less.
 *
 * If another admin created or deleted an item since this client loaded the page,
 * writing a partial order would leave the unknown rows stranded at whatever
 * sort_order they hold, interleaved arbitrarily through the admin's arrangement.
 * 409 instead, and the client refetches.
 */
function validateExhaustive(
  currentIds: ReadonlySet<string>,
  proposedIds: ReadonlyArray<string>,
  scope: CatalogOrderScope
): void {
  const proposed = new Set(proposedIds);
  const missing = [...currentIds].filter((id) => !proposed.has(id));
  const unexpected = proposedIds.filter((id) => !currentIds.has(id));

  if (missing.length > 0 || unexpected.length > 0) {
    throw new CatalogOrderConflictError(
      "This list changed since you loaded it. Refresh to see the latest, then drag again.",
      {
        code: "STALE_CATALOG",
        scope,
        missingIds: missing.length > 0 ? missing : undefined,
        unexpectedIds: unexpected.length > 0 ? unexpected : undefined,
      }
    );
  }
}

/** Only the rows whose position actually moved. */
function computeOrderDiff(
  current: ReadonlyArray<{ id: string; sort_order: number }>,
  proposedIds: ReadonlyArray<string>
): Array<{ id: string; sort_order: number }> {
  const currentById = new Map(current.map((r) => [r.id, r.sort_order]));
  const changes: Array<{ id: string; sort_order: number }> = [];
  proposedIds.forEach((id, index) => {
    if (currentById.get(id) !== index) changes.push({ id, sort_order: index });
  });
  return changes;
}

class OrderedProductsService {
  // -------------------------------------------------------------------------
  // The master switch
  // -------------------------------------------------------------------------

  async getSettings(tenantId: string): Promise<OrderedProductsSettings> {
    const row = await db
      .selectFrom("tenants")
      .select(["ordered_products_enabled", "ordered_products_enabled_at"])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Tenant not found");

    return {
      enabled: row.ordered_products_enabled,
      enabled_at: row.ordered_products_enabled_at,
    };
  }

  /**
   * Flip the switch.
   *
   * Turning it OFF leaves every saved sort_order exactly as the admin arranged
   * it; the catalog simply stops being sorted by it. Switching back on restores
   * the arrangement untouched. Off = not enforced, nothing lost.
   */
  async updateSettings(
    tenantId: string,
    enabled: boolean,
    updatedByUserId: string
  ): Promise<OrderedProductsSettings> {
    const current = await this.getSettings(tenantId);
    if (current.enabled === enabled) return current;

    await db
      .updateTable("tenants")
      .set({
        ordered_products_enabled: enabled,
        // Keep who/when even when switching OFF, the boolean already records
        // that it's off, and nulling these throws away the audit trail the
        // columns exist for the first time anyone toggles.
        ...(enabled
          ? {
              ordered_products_enabled_at: new Date(),
              ordered_products_enabled_by_user_id: updatedByUserId,
            }
          : {}),
        updated_at: new Date(),
      })
      .where("id", "=", tenantId)
      .execute();

    return this.getSettings(tenantId);
  }

  // -------------------------------------------------------------------------
  // Reordering
  // -------------------------------------------------------------------------

  /**
   * Persist a new arrangement for one catalog list.
   *
   * `itemIds` is the COMPLETE desired order for the list the admin is looking
   * at. For courses, `mode` narrows that list to one tab (SELF_PACED / LIVE /
   * HYBRID), dragging within Live must never renumber Self-Paced.
   *
   * Lock siblings FOR UPDATE → verify the set still matches → write only the
   * rows that moved, in one statement. Two admins dragging at once serialise on
   * the lock; the loser gets 409 rather than a half-applied interleaving.
   */
  async reorder(
    tenantId: string,
    entity: string,
    itemIds: unknown,
    options: { mode?: string } = {}
  ): Promise<ReorderResult> {
    const { table, scope } = resolveEntity(entity);
    const ids = validateIdPayload(itemIds, scope);

    const courseScope = this.resolveCourseScope(entity, options.mode);

    return db.transaction().execute(async (trx) => {
      // Deterministic lock order (by id) so concurrent reorders of the same
      // list can't deadlock against each other.
      const locked = await sql<{ id: string; sort_order: number }>`
        SELECT id, sort_order
        FROM ${sql.table(table)}
        WHERE tenant_id = ${tenantId}
        ${courseScope ? sql`AND mode = ${courseScope.mode}::course_mode AND course_type = ${courseScope.courseType}::course_type` : sql``}
        ORDER BY id
        FOR UPDATE
      `.execute(trx);

      const current = locked.rows;
      validateExhaustive(new Set(current.map((r) => r.id)), ids, scope);

      const changes = computeOrderDiff(current, ids);
      if (changes.length === 0) {
        return { updated: 0, items: ids.map((id, i) => ({ id, sort_order: i })) };
      }

      // One statement, hash-joined against a VALUES list, not N round trips.
      const values = changes.map(
        (c) => sql`(${c.id}::text, ${c.sort_order}::int)`
      );
      const result = await sql`
        UPDATE ${sql.table(table)} AS t
        SET sort_order = v.new_order,
            updated_at = NOW()
        FROM (VALUES ${sql.join(values, sql`, `)}) AS v(id, new_order)
        WHERE t.id = v.id
          AND t.tenant_id = ${tenantId}
      `.execute(trx);

      return {
        updated: Number(result.numAffectedRows ?? 0),
        items: ids.map((id, i) => ({ id, sort_order: i })),
      };
    });
  }

  /**
   * Courses are ordered per mode, so a reorder must say which tab it's for.
   * Every other catalog is a single flat list and must NOT carry a mode.
   */
  private resolveCourseScope(
    entity: string,
    mode: string | undefined
  ): { mode: course_mode; courseType: course_type } | null {
    if (entity !== "courses") {
      if (mode) {
        throw new BadRequestError(
          `${entity} is a single list, "mode" only applies to courses`
        );
      }
      return null;
    }
    if (!mode) {
      throw new BadRequestError(
        "Courses are ordered per mode: \"mode\" is required (SELF_PACED)"
      );
    }

    // Courses are self-paced only; the mode parameter stays so the ordering
    // API keeps its shape.
    const valid = ["SELF_PACED"];
    if (!valid.includes(mode)) {
      throw new BadRequestError(
        `Invalid mode "${mode}". Expected one of: ${valid.join(", ")}`
      );
    }
    return { mode: mode as course_mode, courseType: course_type.NORMAL };
  }

  /**
   * The list an admin drags, already in saved order.
   * Ties break on created_at DESC, the pre-ordering default, so a list that
   * has never been arranged still comes back in a stable, familiar sequence.
   */
  async listOrderable(
    tenantId: string,
    entity: string,
    options: { mode?: string } = {}
  ): Promise<OrderableRow[]> {
    const { table } = resolveEntity(entity);
    const courseScope = this.resolveCourseScope(entity, options.mode);

    const rows = await sql<OrderableRow>`
      SELECT id, title, slug, status::text AS status, sort_order
      FROM ${sql.table(table)}
      WHERE tenant_id = ${tenantId}
      ${courseScope ? sql`AND mode = ${courseScope.mode}::course_mode AND course_type = ${courseScope.courseType}::course_type` : sql``}
      ORDER BY sort_order ASC, created_at DESC, id
    `.execute(db);

    return rows.rows;
  }
}

export default new OrderedProductsService();
