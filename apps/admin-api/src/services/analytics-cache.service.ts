import { getRedisClient } from "../lib/redis";
import logger from "../utils/logger";

/**
 * Two-tier analytics cache: L1 (in-memory per worker) + L2 (Redis shared).
 * All analytics data is read-only, so pure TTL-based expiration is sufficient.
 */
class AnalyticsCacheService {
  private l1 = new Map<string, { data: unknown; expiresAt: number }>();
  // Per-key in-flight promises so concurrent misses share one DB hit instead
  // of stampeding the pool. Singleflight pattern.
  private inflight = new Map<string, Promise<unknown>>();

  // ─── L1 (in-memory) ─────────────────────────────────────────────

  private l1Get<T>(key: string): T | null {
    const entry = this.l1.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.l1.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private l1Set(key: string, data: unknown, ttlMs: number): void {
    this.l1.set(key, { data, expiresAt: Date.now() + ttlMs });
    // Prevent unbounded L1 growth, evict oldest if > 500 entries
    if (this.l1.size > 500) {
      const firstKey = this.l1.keys().next().value;
      if (firstKey) this.l1.delete(firstKey);
    }
  }

  // ─── L2 (Redis) ─────────────────────────────────────────────────

  private async l2Get<T>(key: string): Promise<T | null> {
    try {
      const client = await getRedisClient();
      const raw = await client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.warn(`[analytics-cache] L2 get failed key=${key}:`, err);
      return null;
    }
  }

  private async l2Set(key: string, data: unknown, ttlSeconds: number): Promise<void> {
    try {
      const client = await getRedisClient();
      await client.setEx(key, ttlSeconds, JSON.stringify(data));
    } catch (err) {
      logger.warn(`[analytics-cache] L2 set failed key=${key}:`, err);
    }
  }

  // ─── Public API ──────────────────────────────────────────────────

  /**
   * Get from L1, then L2. Returns null on miss.
   */
  async get<T>(key: string): Promise<T | null> {
    // L1 check
    const l1Result = this.l1Get<T>(key);
    if (l1Result !== null) return l1Result;

    // L2 check
    const l2Result = await this.l2Get<T>(key);
    if (l2Result !== null) {
      // Backfill L1 with shorter TTL
      this.l1Set(key, l2Result, 15_000);
      return l2Result;
    }

    return null;
  }

  /**
   * Set in both L1 and L2.
   */
  async set(key: string, data: unknown, l1TtlMs: number, l2TtlSeconds: number): Promise<void> {
    this.l1Set(key, data, l1TtlMs);
    await this.l2Set(key, data, l2TtlSeconds);
  }

  /**
   * Singleflight wrapper: get-or-compute-and-set.
   * If an identical key is already being computed in this worker, await its
   * promise instead of issuing a parallel DB query. Massive protection during
   * dashboard burst-refreshes when L1+L2 both miss simultaneously.
   */
  async wrap<T>(
    key: string,
    l1TtlMs: number,
    l2TtlSeconds: number,
    nocache: boolean,
    compute: () => Promise<T>
  ): Promise<T> {
    if (!nocache) {
      const cached = await this.get<T>(key);
      if (cached !== null) return cached;
    }
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const promise = (async () => {
      try {
        const data = await compute();
        if (data !== null && data !== undefined) {
          this.set(key, data, l1TtlMs, l2TtlSeconds).catch(() => {});
        }
        return data;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }

  // ─── Key builders ────────────────────────────────────────────────

  private buildKey(...parts: string[]): string {
    return parts.join(":");
  }

  overviewKey(tenantId: string, startDate?: string, endDate?: string): string {
    return this.buildKey("analytics", tenantId, "overview", startDate ?? "all", endDate ?? "all");
  }

  recentSignupsKey(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string): string {
    return this.buildKey("analytics", tenantId, "recent-signups", startDate ?? "all", endDate ?? "all", String(page ?? 1), String(limit ?? 10), search ?? "");
  }

  recentOrdersKey(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string): string {
    return this.buildKey("analytics", tenantId, "recent-orders", startDate ?? "all", endDate ?? "all", String(page ?? 1), String(limit ?? 10), search ?? "");
  }

  usersKey(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string): string {
    return this.buildKey("analytics", tenantId, "users", startDate ?? "all", endDate ?? "all", String(page ?? 1), String(limit ?? 50), search ?? "");
  }

  userDetailKey(tenantId: string, memberId: string, startDate?: string, endDate?: string): string {
    return this.buildKey("analytics", tenantId, "user-detail", memberId, startDate ?? "all", endDate ?? "all");
  }

  usersProgressKey(tenantId: string, page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: string, courseId?: string): string {
    return this.buildKey("analytics", tenantId, "users-progress", String(page ?? 1), String(limit ?? 50), search ?? "", sortBy ?? "overall_progress_pct", sortOrder ?? "desc", courseId ?? "");
  }

  coursesKey(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string): string {
    return this.buildKey("analytics", tenantId, "courses", startDate ?? "all", endDate ?? "all", String(page ?? 1), String(limit ?? 20), search ?? "");
  }

  courseDetailKey(tenantId: string, courseId: string, startDate?: string, endDate?: string): string {
    return this.buildKey("analytics", tenantId, "course-detail", courseId, startDate ?? "all", endDate ?? "all");
  }

  booksKey(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string): string {
    return this.buildKey("analytics", tenantId, "books", startDate ?? "all", endDate ?? "all", String(page ?? 1), String(limit ?? 20), search ?? "");
  }

  bookDetailKey(tenantId: string, bookId: string, startDate?: string, endDate?: string): string {
    return this.buildKey("analytics", tenantId, "book-detail", bookId, startDate ?? "all", endDate ?? "all");
  }

  paymentsKey(tenantId: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string): string {
    return this.buildKey("analytics", tenantId, "payments", startDate ?? "all", endDate ?? "all", String(page ?? 1), String(limit ?? 20), search ?? "");
  }

  genericKey(tenantId: string, endpoint: string, startDate?: string, endDate?: string, page?: number, limit?: number, search?: string): string {
    return this.buildKey("analytics", tenantId, endpoint, startDate ?? "all", endDate ?? "all", String(page ?? 1), String(limit ?? 20), search ?? "");
  }

  dashboardKey(tenantId: string): string {
    return this.buildKey("analytics", tenantId, "dashboard");
  }
}

export default new AnalyticsCacheService();
