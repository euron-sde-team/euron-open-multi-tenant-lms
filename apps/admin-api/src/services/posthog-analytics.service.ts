import axios from "axios";

import logger from "../utils/logger";

// Off unless both the project id and a personal API key are set.
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "";
const PERSONAL_API_KEY = PROJECT_ID ? process.env.POSTHOG_PERSONAL_API_KEY || undefined : undefined;
const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
// Session recordings API uses main app host (us.posthog.com), not ingest (us.i.posthog.com)
const POSTHOG_APP_HOST = process.env.POSTHOG_APP_HOST || "https://us.posthog.com";

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

export interface LocationItem { country: string; city: string; count: number }
export interface DeviceItem { name: string; count: number }
export interface ReferrerItem { domain: string; count: number }
export interface CustomEventItem { event: string; count: number }

export interface ClickedElement {
  tag: string;
  text: string;
  click_count: number;
  /** Normalized X (0–1) from PostHog $click_x when available */
  x?: number;
  /** Normalized Y (0–1) from PostHog $click_y when available */
  y?: number;
}

export interface PageHeatmapItem {
  page_url: string;
  total_clicks: number;
  unique_clickers: number;
  avg_scroll_depth: number;
  top_clicked_elements: ClickedElement[];
}

export interface UserSessionItem {
  session_id: string;
  distinct_id: string;
  start_time: string;
  duration_seconds: number;
  page_count: number;
  entry_url: string;
  exit_url: string;
  country: string;
  city: string;
  browser: string;
  os: string;
  device_type: string;
}

/* ------------------------------------------------------------------ */
/*  Per-entity analytics types                                         */
/* ------------------------------------------------------------------ */

export interface EntityAnalytics {
  page_views: number;
  unique_visitors: number;
  session_count: number;
  avg_session_duration_seconds: number;
  total_clicks: number;
  locations: LocationItem[];
  browsers: DeviceItem[];
  operating_systems: DeviceItem[];
  device_types: DeviceItem[];
  referrers: ReferrerItem[];
  daily_views: Array<{ date: string; count: number }>;
  sessions: UserSessionItem[];
}

export interface CourseAnalytics extends EntityAnalytics {
  course_viewed_count: number;
  enrollment_initiated_count: number;
  add_to_cart_count: number;
  payment_initiated_count: number;
  payment_completed_count: number;
}

export interface BookAnalytics extends EntityAnalytics {
  book_viewed_count: number;
  book_purchase_count: number;
  add_to_cart_count: number;
}

export interface UserAnalytics {
  total_events: number;
  total_sessions: number;
  total_pageviews: number;
  avg_session_duration_seconds: number;
  first_seen: string;
  last_seen: string;
  locations: LocationItem[];
  browsers: DeviceItem[];
  operating_systems: DeviceItem[];
  device_types: DeviceItem[];
  top_pages: Array<{ url: string; count: number }>;
  events_breakdown: CustomEventItem[];
  sessions: UserSessionItem[];
  courses_viewed: Array<{ course_id: string; count: number }>;
  books_viewed: Array<{ book_id: string; count: number }>;
}

/* ------------------------------------------------------------------ */
/*  Global insights type                                               */
/* ------------------------------------------------------------------ */

export interface PostHogInsights {
  page_views: number;
  unique_visitors: number;
  session_count: number;
  avg_session_duration_seconds: number;
  top_pages: Array<{ url: string; count: number }>;
  locations: LocationItem[];
  browsers: DeviceItem[];
  operating_systems: DeviceItem[];
  device_types: DeviceItem[];
  referrers: ReferrerItem[];
  custom_events: CustomEventItem[];
  daily_active_users: number;
  weekly_active_users: number;
  monthly_active_users: number;
  new_visitors: number;
  returning_visitors: number;
  bounce_rate: number;
  page_heatmaps: PageHeatmapItem[];
  user_sessions: UserSessionItem[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const CACHE_TTL_MS = 5 * 60 * 1000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, { data: any; timestamp: number }>();

function esc(val: string): string {
  return val.replace(/'/g, "''");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function queryPostHog(hogqlQuery: string, retries = 2): Promise<any[][]> {
  if (!PERSONAL_API_KEY) {
    logger.error("POSTHOG_PERSONAL_API_KEY is not configured");
    throw new Error("Analytics service is not available.");
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(
        `${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query/`,
        { query: { kind: "HogQLQuery", query: hogqlQuery } },
        {
          headers: { Authorization: `Bearer ${PERSONAL_API_KEY}`, "Content-Type": "application/json" },
          timeout: 25000,
        }
      );
      return response.data?.results ?? [];
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const isRetryable = status === 429 || (!status && axios.isAxiosError(err));
      if (isRetryable && attempt < retries) {
        const delay = (attempt + 1) * 2000;
        logger.warn(`[PostHog] Query got ${status ?? "timeout"}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (axios.isAxiosError(err)) {
        logger.error(`[PostHog] Query failed (${status}): ${JSON.stringify(err.response?.data?.detail ?? err.response?.data?.error ?? err.message).slice(0, 300)}`);
        logger.error(`[PostHog] Failing query: ${hogqlQuery.slice(0, 200)}`);
      }
      return [];
    }
  }
  return [];
}

async function batchQuery(queries: string[]): Promise<unknown[][][]> {
  const CONCURRENCY = 8;
  const results: unknown[][][] = [];
  for (let i = 0; i < queries.length; i += CONCURRENCY) {
    const batch = queries.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((q) => queryPostHog(q)));
    results.push(...batchResults);
    if (i + CONCURRENCY < queries.length) await new Promise((r) => setTimeout(r, 200));
  }
  return results;
}

/** Fetch distinct_ids for a person by email via PostHog Persons REST API (for merged identities). */
async function getDistinctIdsByEmail(email: string): Promise<string[]> {
  if (!PERSONAL_API_KEY || !email) return [];
  const appHost = POSTHOG_APP_HOST || "https://us.posthog.com";
  const paths = [
    `/api/projects/${PROJECT_ID}/persons/?email=${encodeURIComponent(email)}&limit=1`,
    `/api/environments/${PROJECT_ID}/persons/?email=${encodeURIComponent(email)}&limit=1`,
  ];
  for (const path of paths) {
    try {
      const res = await axios.get<{ results?: Array<{ distinct_ids?: string[] }> }>(`${appHost}${path}`, {
        headers: { Authorization: `Bearer ${PERSONAL_API_KEY}` },
        timeout: 10000,
      });
      const person = res.data?.results?.[0];
      if (person?.distinct_ids?.length) return person.distinct_ids;
    } catch {
      continue;
    }
  }
  return [];
}

function num(row: unknown[] | undefined, idx: number): number {
  return row?.[idx] != null ? Number(row[idx]) : 0;
}

function str(row: unknown[] | undefined, idx: number): string {
  return row?.[idx] != null ? String(row[idx]) : "";
}

function parseLocations(rows: unknown[][]): LocationItem[] {
  return rows.map((r) => ({ country: str(r, 0) || "Unknown", city: str(r, 1) || "Unknown", count: num(r, 2) }));
}

function parseDevices(rows: unknown[][]): DeviceItem[] {
  return rows.map((r) => ({ name: str(r, 0) || "Unknown", count: num(r, 1) }));
}

/** Normalize date from PostHog (YYYY-MM-DD or ISO string) to YYYY-MM-DD */
function normalizeDate(val: unknown): string {
  const s = val != null ? String(val) : "";
  const datePart = s.includes("T") ? s.split("T")[0] : s.slice(0, 10);
  return datePart || "";
}

/** Fill last N days with zeros for days missing from raw daily views */
function fillDailyViews(
  raw: Array<{ date: string; count: number }>,
  days = 30
): Array<{ date: string; count: number }> {
  const byDate = new Map<string, number>();
  for (const r of raw) {
    const key = normalizeDate(r.date);
    if (key) byDate.set(key, (byDate.get(key) ?? 0) + r.count);
  }
  const result: Array<{ date: string; count: number }> = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: byDate.get(key) ?? 0 });
  }
  return result;
}

function parseSessions(rows: unknown[][]): UserSessionItem[] {
  return rows.map((r) => ({
    session_id: str(r, 0), distinct_id: str(r, 1), start_time: str(r, 2),
    duration_seconds: Math.round(num(r, 3)), page_count: num(r, 4),
    entry_url: str(r, 5), exit_url: str(r, 6),
    country: str(r, 7) || "Unknown", city: str(r, 8) || "Unknown",
    browser: str(r, 9) || "Unknown", os: str(r, 10) || "Unknown",
    device_type: str(r, 11) || "Unknown",
  }));
}

/* ------------------------------------------------------------------ */
/*  Global tenant insights                                             */
/* ------------------------------------------------------------------ */

function emptyInsights(): PostHogInsights {
  return {
    page_views: 0, unique_visitors: 0, session_count: 0, avg_session_duration_seconds: 0,
    top_pages: [], locations: [], browsers: [], operating_systems: [], device_types: [],
    referrers: [], custom_events: [], daily_active_users: 0, weekly_active_users: 0,
    monthly_active_users: 0, new_visitors: 0, returning_visitors: 0, bounce_rate: 0,
    page_heatmaps: [], user_sessions: [],
  };
}

function buildTenantFilter(tenantId: string, tenantSlug: string): string {
  const tid = esc(tenantId);
  const slug = esc(tenantSlug);
  const groupMatch = `properties.$group_0 = '${tid}'`;
  const urlMatch = slug ? `properties.$current_url LIKE '%${slug}.%'` : "";
  const tenantMatch = urlMatch ? `(${groupMatch} OR ${urlMatch})` : groupMatch;
  const excludeAdmin = `properties.$current_url NOT LIKE '%localhost:3001%'`;
  return `${tenantMatch} AND ${excludeAdmin}`;
}

/** More permissive tenant filter for user-specific queries. Includes properties.tenant_id from custom events (course_viewed, book_viewed). */
function buildUserTenantFilter(tenantId: string, tenantSlug: string): string {
  const tid = esc(tenantId);
  const slug = esc(tenantSlug);
  const groupMatch = `properties.$group_0 = '${tid}'`;
  const urlMatch = slug ? `properties.$current_url LIKE '%${slug}.%'` : "";
  const customTenantId = `properties.tenant_id = '${tid}'`;
  const tenantMatch = urlMatch
    ? `(${groupMatch} OR ${urlMatch} OR ${customTenantId})`
    : `(${groupMatch} OR ${customTenantId})`;
  const excludeAdmin = `properties.$current_url NOT LIKE '%localhost:3001%'`;
  return `${tenantMatch} AND ${excludeAdmin}`;
}

export async function getPostHogInsightsForTenant(tenantId: string, tenantSlug = ""): Promise<PostHogInsights> {
  const cacheKey = `posthog:${tenantId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.data;
  if (!PERSONAL_API_KEY) return emptyInsights();

  const tf = buildTenantFilter(tenantId, tenantSlug);
  const l30 = `timestamp >= now() - interval 30 day`;
  const bw = `${tf} AND ${l30}`;

  try {
    const [pvR, uvR, sessR, tpR, locR, brR, osR, dtR, refR, ceR, dauR, wauR, mauR, nvrR, bnR, pcR, usR, elemR] =
      await batchQuery([
        `SELECT count() FROM events WHERE event = '$pageview' AND ${bw}`,
        `SELECT uniq(distinct_id) FROM events WHERE ${bw}`,
        `SELECT uniq(properties.$session_id), avg(toFloatOrZero(properties.$session_duration)) FROM events WHERE ${bw} AND properties.$session_id != ''`,
        `SELECT properties.$current_url, count() FROM events WHERE event = '$pageview' AND ${bw} AND properties.$current_url != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
        `SELECT properties.$geoip_country_name, properties.$geoip_city_name, count() FROM events WHERE ${bw} AND properties.$geoip_country_name != '' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20`,
        `SELECT properties.$browser, count() FROM events WHERE ${bw} AND properties.$browser != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        `SELECT properties.$os, count() FROM events WHERE ${bw} AND properties.$os != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        `SELECT properties.$device_type, count() FROM events WHERE ${bw} AND properties.$device_type != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        `SELECT properties.$referring_domain, count() FROM events WHERE ${bw} AND properties.$referring_domain != '' AND properties.$referring_domain != '$direct' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        `SELECT event, count() FROM events WHERE ${bw} AND event NOT LIKE '$%' GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
        `SELECT uniq(distinct_id) FROM events WHERE ${tf} AND timestamp >= now() - interval 1 day`,
        `SELECT uniq(distinct_id) FROM events WHERE ${tf} AND timestamp >= now() - interval 7 day`,
        `SELECT uniq(distinct_id) FROM events WHERE ${bw}`,
        `SELECT countIf(first_seen >= now() - interval 30 day), countIf(first_seen < now() - interval 30 day) FROM (SELECT distinct_id, min(timestamp) as first_seen FROM events WHERE ${tf} GROUP BY distinct_id HAVING max(timestamp) >= now() - interval 30 day)`,
        `SELECT countIf(page_count = 1), count() FROM (SELECT properties.$session_id as sid, count() as page_count FROM events WHERE event = '$pageview' AND ${bw} AND properties.$session_id != '' GROUP BY sid)`,
        `SELECT properties.$current_url, count(), uniq(distinct_id) FROM events WHERE (event = '$autocapture' OR event = '$rageclick') AND ${bw} AND properties.$current_url != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
        `SELECT properties.$session_id, distinct_id, min(timestamp), max(toFloatOrZero(properties.$session_duration)), count(), argMin(properties.$current_url, timestamp), argMax(properties.$current_url, timestamp), any(properties.$geoip_country_name), any(properties.$geoip_city_name), any(properties.$browser), any(properties.$os), any(properties.$device_type) FROM events WHERE ${bw} AND properties.$session_id != '' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 10`,
        `SELECT properties.$current_url, elements_chain_href, elements_chain_texts, elements_chain_elements, count() FROM events WHERE event = '$autocapture' AND ${bw} AND properties.$current_url != '' GROUP BY 1, 2, 3, 4 ORDER BY 5 DESC LIMIT 200`,
      ]);

    const singleP = num(bnR[0], 0); const totalS = num(bnR[0], 1);

    const pageElementMap = new Map<string, ClickedElement[]>();
    for (const r of elemR) {
      const pageUrl = str(r, 0);
      const tag = str(r, 3) || str(r, 1) || "element";
      const text = str(r, 2) || str(r, 1) || "";
      const clicks = num(r, 4);
      if (!pageElementMap.has(pageUrl)) pageElementMap.set(pageUrl, []);
      pageElementMap.get(pageUrl)!.push({
        tag: tag.split(",")[0] || "element",
        text: text.split(",")[0]?.slice(0, 60) || "",
        click_count: clicks,
      });
    }
    for (const [, elems] of pageElementMap) {
      elems.sort((a, b) => b.click_count - a.click_count);
      elems.splice(10);
    }

    const data: PostHogInsights = {
      page_views: num(pvR[0], 0), unique_visitors: num(uvR[0], 0),
      session_count: num(sessR[0], 0), avg_session_duration_seconds: Math.round(num(sessR[0], 1)),
      top_pages: tpR.map((r) => ({ url: str(r, 0), count: num(r, 1) })),
      locations: parseLocations(locR), browsers: parseDevices(brR),
      operating_systems: parseDevices(osR), device_types: parseDevices(dtR),
      referrers: refR.map((r) => ({ domain: str(r, 0) || "Unknown", count: num(r, 1) })),
      custom_events: ceR.map((r) => ({ event: str(r, 0), count: num(r, 1) })),
      daily_active_users: num(dauR[0], 0), weekly_active_users: num(wauR[0], 0),
      monthly_active_users: num(mauR[0], 0),
      new_visitors: num(nvrR[0], 0), returning_visitors: num(nvrR[0], 1),
      bounce_rate: totalS > 0 ? Math.round((singleP / totalS) * 100) : 0,
      page_heatmaps: pcR.map((r) => ({
        page_url: str(r, 0),
        total_clicks: num(r, 1),
        unique_clickers: num(r, 2),
        avg_scroll_depth: 0,
        top_clicked_elements: pageElementMap.get(str(r, 0)) ?? [],
      })),
      user_sessions: parseSessions(usR),
    };

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    logger.error("[PostHog] Failed to fetch insights:", err);
    return emptyInsights();
  }
}

/* ------------------------------------------------------------------ */
/*  Per-Course analytics                                               */
/* ------------------------------------------------------------------ */

function emptyCourseAnalytics(): CourseAnalytics {
  return {
    page_views: 0, unique_visitors: 0, session_count: 0, avg_session_duration_seconds: 0,
    total_clicks: 0, locations: [], browsers: [], operating_systems: [], device_types: [],
    referrers: [], daily_views: [], sessions: [],
    course_viewed_count: 0, enrollment_initiated_count: 0, add_to_cart_count: 0,
    payment_initiated_count: 0, payment_completed_count: 0,
  };
}

export async function getCourseAnalytics(tenantId: string, courseSlug: string, tenantSlug = ""): Promise<CourseAnalytics> {
  const cacheKey = `posthog:course:${tenantId}:${courseSlug}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.data;
  if (!PERSONAL_API_KEY) return emptyCourseAnalytics();

  const slug = esc(courseSlug);
  const tf = buildTenantFilter(tenantId, tenantSlug);
  const l30 = `timestamp >= now() - interval 30 day`;
  const pageFilter = `properties.$current_url LIKE '%/courses/${slug}%'`;
  const bw = `${tf} AND ${l30}`;
  const pageBw = `${bw} AND ${pageFilter}`;

  try {
    const [pvR, uvR, sessR, clickR, locR, brR, osR, dtR, refR, dailyR, sessListR, cvR, eiR, acR, piR, pcR] =
      await batchQuery([
        `SELECT count() FROM events WHERE event = '$pageview' AND ${pageBw}`,
        `SELECT uniq(distinct_id) FROM events WHERE event = '$pageview' AND ${pageBw}`,
        `SELECT uniq(properties.$session_id), avg(toFloatOrZero(properties.$session_duration)) FROM events WHERE ${pageBw} AND properties.$session_id != ''`,
        `SELECT count() FROM events WHERE (event = '$autocapture' OR event = '$rageclick') AND ${pageBw}`,
        `SELECT properties.$geoip_country_name, properties.$geoip_city_name, count() FROM events WHERE ${pageBw} AND properties.$geoip_country_name != '' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 15`,
        `SELECT properties.$browser, count() FROM events WHERE ${pageBw} AND properties.$browser != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        `SELECT properties.$os, count() FROM events WHERE ${pageBw} AND properties.$os != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        `SELECT properties.$device_type, count() FROM events WHERE ${pageBw} AND properties.$device_type != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        `SELECT properties.$referring_domain, count() FROM events WHERE ${pageBw} AND properties.$referring_domain != '' AND properties.$referring_domain != '$direct' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        `SELECT toString(toDate(timestamp)) as day, count() FROM events WHERE event = '$pageview' AND ${pageBw} GROUP BY day ORDER BY day`,
        `SELECT properties.$session_id, distinct_id, min(timestamp), max(toFloatOrZero(properties.$session_duration)), count(), argMin(properties.$current_url, timestamp), argMax(properties.$current_url, timestamp), any(properties.$geoip_country_name), any(properties.$geoip_city_name), any(properties.$browser), any(properties.$os), any(properties.$device_type) FROM events WHERE ${pageBw} AND properties.$session_id != '' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 30`,
        `SELECT count() FROM events WHERE event = 'course_viewed' AND ${bw} AND properties.course_slug = '${slug}'`,
        `SELECT count() FROM events WHERE event = 'enrollment_initiated' AND ${bw} AND properties.course_id != '' AND properties.$current_url LIKE '%/courses/${slug}%'`,
        `SELECT count() FROM events WHERE event = 'add_to_cart' AND ${bw} AND properties.item_type = 'COURSE' AND properties.$current_url LIKE '%/courses/${slug}%'`,
        `SELECT count() FROM events WHERE event = 'payment_initiated' AND ${bw} AND properties.$current_url LIKE '%/courses/${slug}%'`,
        `SELECT count() FROM events WHERE event = 'payment_completed' AND ${bw} AND properties.$current_url LIKE '%/courses/${slug}%'`,
      ]);

    const data: CourseAnalytics = {
      page_views: num(pvR[0], 0), unique_visitors: num(uvR[0], 0),
      session_count: num(sessR[0], 0), avg_session_duration_seconds: Math.round(num(sessR[0], 1)),
      total_clicks: num(clickR[0], 0),
      locations: parseLocations(locR), browsers: parseDevices(brR),
      operating_systems: parseDevices(osR), device_types: parseDevices(dtR),
      referrers: refR.map((r) => ({ domain: str(r, 0) || "Unknown", count: num(r, 1) })),
      daily_views: fillDailyViews(dailyR.map((r) => ({ date: normalizeDate(r[0]), count: num(r, 1) }))),
      sessions: parseSessions(sessListR),
      course_viewed_count: num(cvR[0], 0),
      enrollment_initiated_count: num(eiR[0], 0),
      add_to_cart_count: num(acR[0], 0),
      payment_initiated_count: num(piR[0], 0),
      payment_completed_count: num(pcR[0], 0),
    };

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    logger.error("[PostHog] Failed to fetch course analytics:", err);
    return emptyCourseAnalytics();
  }
}

/* ------------------------------------------------------------------ */
/*  Per-Book analytics                                                 */
/* ------------------------------------------------------------------ */

function emptyBookAnalytics(): BookAnalytics {
  return {
    page_views: 0, unique_visitors: 0, session_count: 0, avg_session_duration_seconds: 0,
    total_clicks: 0, locations: [], browsers: [], operating_systems: [], device_types: [],
    referrers: [], daily_views: [], sessions: [],
    book_viewed_count: 0, book_purchase_count: 0, add_to_cart_count: 0,
  };
}

export async function getBookAnalytics(tenantId: string, bookSlug: string, tenantSlug = ""): Promise<BookAnalytics> {
  const cacheKey = `posthog:book:${tenantId}:${bookSlug}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.data;
  if (!PERSONAL_API_KEY) return emptyBookAnalytics();

  const slug = esc(bookSlug);
  const tf = buildTenantFilter(tenantId, tenantSlug);
  const l30 = `timestamp >= now() - interval 30 day`;
  const pageFilter = `properties.$current_url LIKE '%/books/${slug}%'`;
  const bw = `${tf} AND ${l30}`;
  const pageBw = `${bw} AND ${pageFilter}`;

  try {
    const [pvR, uvR, sessR, clickR, locR, brR, osR, dtR, refR, dailyR, sessListR, bvR, bpR, acR] =
      await batchQuery([
        `SELECT count() FROM events WHERE event = '$pageview' AND ${pageBw}`,
        `SELECT uniq(distinct_id) FROM events WHERE event = '$pageview' AND ${pageBw}`,
        `SELECT uniq(properties.$session_id), avg(toFloatOrZero(properties.$session_duration)) FROM events WHERE ${pageBw} AND properties.$session_id != ''`,
        `SELECT count() FROM events WHERE (event = '$autocapture' OR event = '$rageclick') AND ${pageBw}`,
        `SELECT properties.$geoip_country_name, properties.$geoip_city_name, count() FROM events WHERE ${pageBw} AND properties.$geoip_country_name != '' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 15`,
        `SELECT properties.$browser, count() FROM events WHERE ${pageBw} AND properties.$browser != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        `SELECT properties.$os, count() FROM events WHERE ${pageBw} AND properties.$os != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        `SELECT properties.$device_type, count() FROM events WHERE ${pageBw} AND properties.$device_type != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        `SELECT properties.$referring_domain, count() FROM events WHERE ${pageBw} AND properties.$referring_domain != '' AND properties.$referring_domain != '$direct' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        `SELECT toString(toDate(timestamp)) as day, count() FROM events WHERE event = '$pageview' AND ${pageBw} GROUP BY day ORDER BY day`,
        `SELECT properties.$session_id, distinct_id, min(timestamp), max(toFloatOrZero(properties.$session_duration)), count(), argMin(properties.$current_url, timestamp), argMax(properties.$current_url, timestamp), any(properties.$geoip_country_name), any(properties.$geoip_city_name), any(properties.$browser), any(properties.$os), any(properties.$device_type) FROM events WHERE ${pageBw} AND properties.$session_id != '' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 30`,
        `SELECT count() FROM events WHERE event = 'book_viewed' AND ${bw} AND properties.book_slug = '${slug}'`,
        `SELECT count() FROM events WHERE event = 'book_purchase' AND ${bw} AND properties.$current_url LIKE '%/books/${slug}%'`,
        `SELECT count() FROM events WHERE event = 'add_to_cart' AND ${bw} AND properties.item_type = 'BOOK' AND properties.$current_url LIKE '%/books/${slug}%'`,
      ]);

    const data: BookAnalytics = {
      page_views: num(pvR[0], 0), unique_visitors: num(uvR[0], 0),
      session_count: num(sessR[0], 0), avg_session_duration_seconds: Math.round(num(sessR[0], 1)),
      total_clicks: num(clickR[0], 0),
      locations: parseLocations(locR), browsers: parseDevices(brR),
      operating_systems: parseDevices(osR), device_types: parseDevices(dtR),
      referrers: refR.map((r) => ({ domain: str(r, 0) || "Unknown", count: num(r, 1) })),
      daily_views: fillDailyViews(dailyR.map((r) => ({ date: normalizeDate(r[0]), count: num(r, 1) }))),
      sessions: parseSessions(sessListR),
      book_viewed_count: num(bvR[0], 0), book_purchase_count: num(bpR[0], 0),
      add_to_cart_count: num(acR[0], 0),
    };

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    logger.error("[PostHog] Failed to fetch book analytics:", err);
    return emptyBookAnalytics();
  }
}

/* ------------------------------------------------------------------ */
/*  Per-User analytics                                                 */
/* ------------------------------------------------------------------ */

function emptyUserAnalytics(): UserAnalytics {
  return {
    total_events: 0, total_sessions: 0, total_pageviews: 0, avg_session_duration_seconds: 0,
    first_seen: "", last_seen: "", locations: [], browsers: [], operating_systems: [],
    device_types: [], top_pages: [], events_breakdown: [], sessions: [],
    courses_viewed: [], books_viewed: [],
  };
}

export async function getUserAnalytics(
  tenantId: string,
  userId: string,
  options?: { tenantSlug?: string; userEmail?: string }
): Promise<UserAnalytics> {
  const tenantSlug = options?.tenantSlug ?? "";
  const userEmail = options?.userEmail;
  const cacheKey = `posthog:user:${tenantId}:${userId}:${userEmail ?? ""}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.data;
  if (!PERSONAL_API_KEY) return emptyUserAnalytics();

  // Use permissive tenant filter for user queries: includes properties.tenant_id from custom events (course_viewed, book_viewed)
  const tf = buildUserTenantFilter(tenantId, tenantSlug);
  // Build distinct_ids list: our expected IDs + any from Persons API by email (for merged identities)
  const distinctIds = new Set<string>([`${tenantId}:${userId}`, userId]);
  if (userEmail) {
    const apiIds = await getDistinctIdsByEmail(userEmail);
    apiIds.forEach((id) => distinctIds.add(id));
  }
  const distinctIdList = Array.from(distinctIds).map((id) => `'${esc(id)}'`).join(", ");
  const uf = `distinct_id IN (${distinctIdList})`;
  const bw = `${tf} AND ${uf}`;

  try {
    const [evtR, sessR, pvR, timeR, locR, brR, osR, dtR, tpR, ebR, sessListR, cvR, bvR] =
      await batchQuery([
        `SELECT count() FROM events WHERE ${bw}`,
        `SELECT uniq(properties.$session_id), avg(toFloatOrZero(properties.$session_duration)) FROM events WHERE ${bw} AND properties.$session_id != ''`,
        `SELECT count() FROM events WHERE event = '$pageview' AND ${bw}`,
        `SELECT min(timestamp), max(timestamp) FROM events WHERE ${bw}`,
        `SELECT properties.$geoip_country_name, properties.$geoip_city_name, count() FROM events WHERE ${bw} AND properties.$geoip_country_name != '' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 10`,
        `SELECT properties.$browser, count() FROM events WHERE ${bw} AND properties.$browser != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
        `SELECT properties.$os, count() FROM events WHERE ${bw} AND properties.$os != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
        `SELECT properties.$device_type, count() FROM events WHERE ${bw} AND properties.$device_type != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
        `SELECT properties.$current_url, count() FROM events WHERE event = '$pageview' AND ${bw} AND properties.$current_url != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
        `SELECT event, count() FROM events WHERE ${bw} GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
        `SELECT properties.$session_id, distinct_id, min(timestamp), max(toFloatOrZero(properties.$session_duration)), count(), argMin(properties.$current_url, timestamp), argMax(properties.$current_url, timestamp), any(properties.$geoip_country_name), any(properties.$geoip_city_name), any(properties.$browser), any(properties.$os), any(properties.$device_type) FROM events WHERE ${bw} AND properties.$session_id != '' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 30`,
        `SELECT properties.course_id, count() FROM events WHERE event = 'course_viewed' AND ${bw} AND properties.course_id != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
        `SELECT properties.book_id, count() FROM events WHERE event = 'book_viewed' AND ${bw} AND properties.book_id != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
      ]);

    const totalEvents = num(evtR[0], 0);

    const data: UserAnalytics = {
      total_events: totalEvents,
      total_sessions: num(sessR[0], 0),
      total_pageviews: num(pvR[0], 0),
      avg_session_duration_seconds: Math.round(num(sessR[0], 1)),
      first_seen: str(timeR[0], 0), last_seen: str(timeR[0], 1),
      locations: parseLocations(locR), browsers: parseDevices(brR),
      operating_systems: parseDevices(osR), device_types: parseDevices(dtR),
      top_pages: tpR.map((r) => ({ url: str(r, 0), count: num(r, 1) })),
      events_breakdown: ebR.map((r) => ({ event: str(r, 0), count: num(r, 1) })),
      sessions: parseSessions(sessListR),
      courses_viewed: cvR.map((r) => ({ course_id: str(r, 0), count: num(r, 1) })),
      books_viewed: bvR.map((r) => ({ book_id: str(r, 0), count: num(r, 1) })),
    };

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    logger.error("[PostHog] Failed to fetch user analytics:", err);
    return emptyUserAnalytics();
  }
}

/* ------------------------------------------------------------------ */
/*  Per-Page Heatmap Detail                                            */
/* ------------------------------------------------------------------ */

export interface HeatmapPoint {
  x: number;
  y: number;
  count: number;
}

export interface PageHeatmapDetail {
  page_url: string;
  total_clicks: number;
  unique_clickers: number;
  total_pageviews: number;
  unique_viewers: number;
  avg_time_on_page_seconds: number;
  top_clicked_elements: ClickedElement[];
  /** Coordinate-based heatmap points (0-1 normalized) from PostHog $click_x/$click_y when available */
  heatmap_points: HeatmapPoint[];
  click_by_device: DeviceItem[];
  click_by_browser: DeviceItem[];
  click_timeline: Array<{ hour: string; count: number }>;
  sessions_on_page: UserSessionItem[];
}

function emptyPageHeatmapDetail(): PageHeatmapDetail {
  return {
    page_url: "", total_clicks: 0, unique_clickers: 0,
    total_pageviews: 0, unique_viewers: 0, avg_time_on_page_seconds: 0,
    top_clicked_elements: [], heatmap_points: [],
    click_by_device: [], click_by_browser: [],
    click_timeline: [], sessions_on_page: [],
  };
}

export async function getPageHeatmapDetail(tenantId: string, pageUrl: string, tenantSlug = ""): Promise<PageHeatmapDetail> {
  const cacheKey = `posthog:page-heatmap:${tenantId}:${pageUrl}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.data;
  if (!PERSONAL_API_KEY) return emptyPageHeatmapDetail();

  const tf = buildTenantFilter(tenantId, tenantSlug);
  const l30 = `timestamp >= now() - interval 30 day`;

  const escapedUrl = esc(pageUrl);
  const urlNoSlash = escapedUrl.replace(/\/$/, "");
  const urlWithSlash = urlNoSlash + "/";
  // Parse URL to detect root, when path is /, also match /home (home is only served at root)
  let pf: string;
  try {
    const u = new URL(pageUrl);
    const isRoot = u.pathname === "/" || u.pathname === "/home" || u.pathname === "/home/";
    if (isRoot) {
      const hostWithProtocol = `${u.protocol}//${u.host}`;
      const homeUrl = esc(`${hostWithProtocol}/home`);
      const homeUrlSlash = esc(`${hostWithProtocol}/home/`);
      pf = `(properties.$current_url = '${escapedUrl}' OR properties.$current_url = '${urlNoSlash}' OR properties.$current_url = '${urlWithSlash}' OR properties.$current_url = '${homeUrl}' OR properties.$current_url = '${homeUrlSlash}' OR properties.$current_url LIKE '${urlNoSlash}?%' OR properties.$current_url LIKE '${urlNoSlash}#%' OR properties.$current_url LIKE '${homeUrl}?%' OR properties.$current_url LIKE '${homeUrl}#%')`;
    } else {
      pf = `(properties.$current_url = '${escapedUrl}' OR properties.$current_url = '${urlNoSlash}' OR properties.$current_url = '${urlWithSlash}' OR properties.$current_url LIKE '${urlNoSlash}?%' OR properties.$current_url LIKE '${urlNoSlash}#%')`;
    }
  } catch {
    pf = `(properties.$current_url = '${escapedUrl}' OR properties.$current_url = '${urlNoSlash}' OR properties.$current_url = '${urlWithSlash}' OR properties.$current_url LIKE '${urlNoSlash}?%' OR properties.$current_url LIKE '${urlNoSlash}#%')`;
  }
  const bw = `${tf} AND ${l30} AND ${pf}`;

  logger.info(`[PostHog] Page heatmap query, pageUrl: ${pageUrl}, filter: ${pf.slice(0, 200)}`);

  try {
    const [clicksR, pvR, elemR, heatmapR, devR, brR, timelineR, sessR] = await batchQuery([
      `SELECT count(), uniq(distinct_id) FROM events WHERE (event = '$autocapture' OR event = '$rageclick') AND ${bw}`,
      `SELECT count(), uniq(distinct_id), avg(toFloatOrZero(properties.$session_duration)) FROM events WHERE event = '$pageview' AND ${bw}`,
      `SELECT elements_chain_elements, elements_chain_texts, elements_chain_href, count() FROM events WHERE event = '$autocapture' AND ${bw} GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 50`,
      `SELECT round(toFloat64OrZero(properties.$click_x) / greatest(1, toFloat64OrZero(properties.$viewport_width)), 4), round(toFloat64OrZero(properties.$click_y) / greatest(1, toFloat64OrZero(properties.$viewport_height)), 4), count() FROM events WHERE event = '$autocapture' AND ${bw} AND toFloat64OrZero(properties.$click_x) >= 0 AND toFloat64OrZero(properties.$click_y) >= 0 AND toFloat64OrZero(properties.$viewport_width) > 0 AND toFloat64OrZero(properties.$viewport_height) > 0 GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 200`,
      `SELECT properties.$device_type, count() FROM events WHERE (event = '$autocapture' OR event = '$rageclick') AND ${bw} AND properties.$device_type != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
      `SELECT properties.$browser, count() FROM events WHERE (event = '$autocapture' OR event = '$rageclick') AND ${bw} AND properties.$browser != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
      `SELECT toHour(timestamp), count() FROM events WHERE (event = '$autocapture' OR event = '$rageclick') AND ${bw} GROUP BY 1 ORDER BY 1`,
      `SELECT properties.$session_id, distinct_id, min(timestamp), max(toFloatOrZero(properties.$session_duration)), count(), argMin(properties.$current_url, timestamp), argMax(properties.$current_url, timestamp), any(properties.$geoip_country_name), any(properties.$geoip_city_name), any(properties.$browser), any(properties.$os), any(properties.$device_type) FROM events WHERE ${bw} AND properties.$session_id != '' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20`,
    ]);

    logger.info(`[PostHog] Page heatmap results, clicks: ${JSON.stringify(clicksR[0])}, pageviews: ${JSON.stringify(pvR[0])}, elements: ${elemR.length}, heatmapPoints: ${heatmapR.length}, timeline: ${timelineR.length} hours, sessions: ${sessR.length}`);

    const elements: ClickedElement[] = elemR.map((r) => ({
      tag: (str(r, 0) || "element").split(",")[0] || "element",
      text: (str(r, 1) || str(r, 2) || "").split(",")[0]?.slice(0, 80) || "",
      click_count: num(r, 3),
    }));
    const mergedElements = new Map<string, ClickedElement>();
    for (const el of elements) {
      const key = `${el.tag}:${el.text}`;
      const existing = mergedElements.get(key);
      if (existing) {
        existing.click_count += el.click_count;
      } else {
        mergedElements.set(key, { ...el });
      }
    }
    const sortedElements = Array.from(mergedElements.values())
      .sort((a, b) => b.click_count - a.click_count)
      .slice(0, 20);

    const heatmapPoints: HeatmapPoint[] = heatmapR.map((r) => ({
      x: num(r, 0),
      y: num(r, 1),
      count: num(r, 2),
    })).filter((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 && p.count > 0);

    const data: PageHeatmapDetail = {
      page_url: pageUrl,
      total_clicks: num(clicksR[0], 0),
      unique_clickers: num(clicksR[0], 1),
      total_pageviews: num(pvR[0], 0),
      unique_viewers: num(pvR[0], 1),
      avg_time_on_page_seconds: Math.round(num(pvR[0], 2)),
      top_clicked_elements: sortedElements,
      heatmap_points: heatmapPoints,
      click_by_device: parseDevices(devR),
      click_by_browser: parseDevices(brR),
      click_timeline: timelineR.map((r) => ({ hour: `${String(num(r, 0)).padStart(2, "0")}:00`, count: num(r, 1) })),
      sessions_on_page: parseSessions(sessR),
    };

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    logger.error("[PostHog] Failed to fetch page heatmap detail:", err);
    return emptyPageHeatmapDetail();
  }
}

/**
 * Verify that a session recording belongs to the tenant (prevents cross-tenant access).
 * Uses the same tenant filter as other PostHog queries.
 */
async function verifySessionBelongsToTenant(
  tenantId: string,
  sessionId: string,
  tenantSlug = ""
): Promise<boolean> {
  if (!PERSONAL_API_KEY || !sessionId?.trim()) return false;
  const tf = buildTenantFilter(tenantId, tenantSlug);
  const sid = esc(sessionId);
  const hogql = `SELECT 1 FROM events WHERE properties.$session_id = '${sid}' AND ${tf} LIMIT 1`;
  const results = await queryPostHog(hogql);
  return Array.isArray(results) && results.length > 0 && results[0]?.length > 0;
}

/**
 * Get embed token for session replay so tenants can watch in-app without PostHog access.
 * Uses PostHog sharing API: enables sharing and returns access_token for embed URL.
 * Verifies the session belongs to the tenant before returning the token.
 */
export async function getReplayEmbedToken(
  tenantId: string,
  sessionId: string,
  tenantSlug = ""
): Promise<{ embedUrl: string } | null> {
  if (!PERSONAL_API_KEY || !sessionId?.trim()) return null;

  const belongsToTenant = await verifySessionBelongsToTenant(tenantId, sessionId, tenantSlug);
  if (!belongsToTenant) {
    logger.warn(`[PostHog] Replay embed denied: session ${sessionId} does not belong to tenant ${tenantId}`);
    return null;
  }

  try {
    const baseUrl = `${POSTHOG_APP_HOST}/api/projects/${PROJECT_ID}/session_recordings/${encodeURIComponent(sessionId)}/sharing`;
    const headers = {
      Authorization: `Bearer ${PERSONAL_API_KEY}`,
      "Content-Type": "application/json",
    };
    const body = { enabled: true };

    // Try PATCH first (per PostHog sharing docs); fallback to POST refresh
    let response;
    try {
      response = await axios.patch(baseUrl, body, { headers, timeout: 15000 });
    } catch (patchErr) {
      if (axios.isAxiosError(patchErr) && (patchErr.response?.status === 404 || patchErr.response?.status === 405)) {
        response = await axios.post(`${baseUrl}/refresh`, body, { headers, timeout: 15000 });
      } else {
        throw patchErr;
      }
    }

    const accessToken = response.data?.access_token ?? response.data?.accessToken;
    if (!accessToken) return null;

    // PostHog embed viewer: app.posthog.com (per docs); us.posthog.com may 404
    const embedHost = POSTHOG_APP_HOST.includes("us.posthog.com") ? "https://app.posthog.com" : POSTHOG_APP_HOST;
    const embedUrl = `${embedHost}/embedded/${accessToken}`;
    return { embedUrl };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      logger.error(`[PostHog] Replay embed token failed: ${err.response?.status} ${JSON.stringify(err.response?.data ?? err.message).slice(0, 200)}`);
    } else {
      logger.error("[PostHog] Replay embed token failed:", err);
    }
    return null;
  }
}
