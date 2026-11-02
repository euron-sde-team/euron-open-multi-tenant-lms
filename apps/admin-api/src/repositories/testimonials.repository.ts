/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "../db/connection";
import { Kysely, sql } from "kysely";
import type { DB } from "../db/types";

class TestimonialsRepository {
  async findByTenantId(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string; status?: string },
    trx?: Kysely<DB>
  ) {
    const conn = trx || db;
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = conn
      .selectFrom("testimonials")
      .leftJoin("tenant_members", "tenant_members.id", "testimonials.tenant_member_id")
      .where("testimonials.tenant_id", "=", tenantId);

    if (params.status) {
      query = query.where("testimonials.status", "=", params.status as any);
    }
    if (params.search) {
      query = query.where((eb) =>
        eb.or([
          eb("testimonials.name", "ilike", `%${params.search}%`),
          eb("testimonials.text", "ilike", `%${params.search}%`),
        ])
      );
    }

    const [rows, countResult] = await Promise.all([
      query
        .select([
          "testimonials.id",
          "testimonials.tenant_id",
          "testimonials.tenant_member_id",
          "testimonials.name",
          "testimonials.text",
          "testimonials.image_url",
          "testimonials.social_links",
          "testimonials.rating",
          "testimonials.status",
          "testimonials.created_at",
          "testimonials.updated_at",
          "tenant_members.name as member_name",
          "tenant_members.email as member_email",
          "tenant_members.avatar_url as member_avatar",
        ])
        .orderBy("testimonials.created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      conn
        .selectFrom("testimonials")
        .where("testimonials.tenant_id", "=", tenantId)
        .$if(!!params.status, (qb) =>
          qb.where("testimonials.status", "=", params.status as any)
        )
        .$if(!!params.search, (qb) =>
          qb.where((eb) =>
            eb.or([
              eb("testimonials.name", "ilike", `%${params.search}%`),
              eb("testimonials.text", "ilike", `%${params.search}%`),
            ])
          )
        )
        .select(conn.fn.countAll<string>().as("count"))
        .executeTakeFirstOrThrow(),
    ]);

    const total =
      typeof countResult.count === "string"
        ? parseInt(countResult.count, 10)
        : Number(countResult.count ?? 0);

    return { rows, total, page, limit };
  }

  async findById(id: string, trx?: Kysely<DB>) {
    const conn = trx || db;
    return conn
      .selectFrom("testimonials")
      .leftJoin("tenant_members", "tenant_members.id", "testimonials.tenant_member_id")
      .where("testimonials.id", "=", id)
      .select([
        "testimonials.id",
        "testimonials.tenant_id",
        "testimonials.tenant_member_id",
        "testimonials.name",
        "testimonials.text",
        "testimonials.image_url",
        "testimonials.social_links",
        "testimonials.rating",
        "testimonials.status",
        "testimonials.created_at",
        "testimonials.updated_at",
        "tenant_members.name as member_name",
        "tenant_members.email as member_email",
        "tenant_members.avatar_url as member_avatar",
      ])
      .executeTakeFirst();
  }

  async getStats(tenantId: string, trx?: Kysely<DB>) {
    const conn = trx || db;
    const result = await conn
      .selectFrom("testimonials")
      .where("tenant_id", "=", tenantId)
      .select([
        conn.fn.countAll<string>().as("total"),
        sql<string>`count(*) FILTER (WHERE status = 'PENDING')`.as("pending"),
        sql<string>`count(*) FILTER (WHERE status = 'APPROVED')`.as("approved"),
        sql<string>`count(*) FILTER (WHERE status = 'REJECTED')`.as("rejected"),
      ])
      .executeTakeFirstOrThrow();

    return {
      total: parseInt(result.total, 10),
      pending: parseInt(result.pending, 10),
      approved: parseInt(result.approved, 10),
      rejected: parseInt(result.rejected, 10),
    };
  }

  async create(
    data: {
      id: string;
      tenant_id: string;
      tenant_member_id?: string | null;
      name: string;
      text?: string | null;
      image_url?: string | null;
      social_links?: unknown | null;
      rating?: number | null;
      status: string;
      created_at: Date;
      updated_at: Date;
    },
    trx?: Kysely<DB>
  ) {
    const conn = trx || db;
    return conn
      .insertInto("testimonials")
      .values(data as any)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(
    id: string,
    data: {
      name?: string;
      text?: string | null;
      image_url?: string | null;
      social_links?: unknown | null;
      rating?: number | null;
      status?: string;
      tenant_member_id?: string | null;
      updated_at?: Date;
    },
    trx?: Kysely<DB>
  ) {
    const conn = trx || db;
    const result = await conn
      .updateTable("testimonials")
      .set(data as any)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
    return result ?? null;
  }

  async delete(id: string, trx?: Kysely<DB>): Promise<boolean> {
    const conn = trx || db;
    const result = await conn
      .deleteFrom("testimonials")
      .where("id", "=", id)
      .executeTakeFirst();
    return BigInt(result.numDeletedRows) > 0n;
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: string,
    trx?: Kysely<DB>
  ) {
    const conn = trx || db;
    const result = await conn
      .updateTable("testimonials")
      .set({ status: status as any, updated_at: new Date() })
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
    return result ?? null;
  }
}

const testimonialsRepository = new TestimonialsRepository();
export default testimonialsRepository;
