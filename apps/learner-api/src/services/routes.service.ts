/**
 * Routes Service
 *
 * Returns available internal routes for a tenant (published pages, courses, books).
 * Used by the web app via template.availableRoutes for EditableClickable and link validation.
 */

import { db } from "../db/connection";
import { course_status, book_status } from "../db/enums";

export interface AvailableRoute {
  path: string;
  label: string;
  category?: string;
}

export interface AvailableRoutesResponse {
  internal: AvailableRoute[];
  system: AvailableRoute[];
}

const SYSTEM_ROUTES: AvailableRoute[] = [
  // Main
  { path: "/", label: "Home", category: "main" },
  { path: "/search", label: "Search", category: "main" },
  { path: "/categories", label: "Categories", category: "main" },
  { path: "/bundles", label: "Bundles", category: "main" },
  // Auth
  { path: "/login", label: "Login", category: "auth" },
  { path: "/learn", label: "Learning Dashboard", category: "auth" },
  { path: "/profile", label: "Profile", category: "auth" },
  { path: "/my-learning", label: "My Learning", category: "auth" },
  // Courses
  { path: "/all-courses", label: "All Courses", category: "courses" },
  { path: "/self-paced", label: "Self-Paced Courses", category: "courses" },
  // Books
  { path: "/books", label: "Books", category: "books" },
  // Commerce
  { path: "/cart", label: "Cart", category: "commerce" },
  { path: "/bookmark", label: "Bookmarks", category: "commerce" },
  { path: "/testimonials", label: "Testimonials", category: "main" },
  // Subscription
  { path: "/subscribe", label: "Subscribe", category: "auth" },
  { path: "/account/subscription", label: "Subscription Management", category: "auth" },
];

class RoutesService {
  async getAvailableRoutes(tenantId: string): Promise<AvailableRoutesResponse> {
    const [pages, courses, books] = await Promise.all([
      this.getPublishedPages(tenantId),
      this.getPublishedCourses(tenantId),
      this.getPublishedBooks(tenantId),
    ]);

    const internal: AvailableRoute[] = [];

    for (const p of pages) {
      const path = p.slug === "home" || p.slug === "" ? "/" : `/${p.slug}`;
      // Skip root page, system already has "Home" for "/" to avoid duplicate entries
      if (path === "/") continue;
      internal.push({
        path,
        label: p.title,
        category: "pages",
      });
    }

    for (const c of courses) {
      internal.push({
        path: `/courses/${c.slug}`,
        label: c.title,
        category: "courses",
      });
    }

    for (const b of books) {
      internal.push({
        path: `/books/${b.slug}`,
        label: b.title,
        category: "books",
      });
    }

    const seen = new Set<string>();
    const deduped = internal.filter((r) => {
      if (seen.has(r.path)) return false;
      seen.add(r.path);
      return true;
    });

    const order = ["main", "pages", "courses", "books", "auth"];
    deduped.sort((a, b) => {
      const ia = order.indexOf(a.category ?? "");
      const ib = order.indexOf(b.category ?? "");
      if (ia !== ib) return ia - ib;
      return a.label.localeCompare(b.label);
    });

    return {
      internal: deduped,
      system: SYSTEM_ROUTES,
    };
  }

  private async getPublishedPages(
    tenantId: string
  ): Promise<{ slug: string; title: string }[]> {
    const results = await db
      .selectFrom("tenant_pages")
      .select(["slug", "title"])
      .where("tenant_id", "=", tenantId)
      .where("is_published", "=", true)
      .orderBy("created_at", "asc")
      .execute();
    return results.map((r) => ({ slug: r.slug, title: r.title }));
  }

  private async getPublishedCourses(
    tenantId: string
  ): Promise<{ slug: string; title: string }[]> {
    const results = await db
      .selectFrom("courses")
      .select(["slug", "title"])
      .where("tenant_id", "=", tenantId)
      .where("status", "=", course_status.PUBLISHED)
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "desc")
      .limit(500)
      .execute();
    return results.map((r) => ({ slug: r.slug, title: r.title }));
  }

  private async getPublishedBooks(
    tenantId: string
  ): Promise<{ slug: string; title: string }[]> {
    const results = await db
      .selectFrom("books")
      .select(["slug", "title"])
      .where("tenant_id", "=", tenantId)
      .where("status", "=", book_status.PUBLISHED)
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "desc")
      .limit(500)
      .execute();
    return results.map((r) => ({ slug: r.slug, title: r.title }));
  }
}

export default new RoutesService();
