/**
 * System Routes
 *
 * Platform-level routes that exist in the app regardless of tenant.
 * Used by: web app, admin app (via API response).
 *
 * NOTE: the backends (admin-api, learner-api) keep their own SYSTEM_ROUTES copy.
 * When adding a new route: (1) Add here, (2) Update both backend routes.service.ts.
 */

import type { AvailableRoute } from "../types/link";

export const SYSTEM_ROUTES: AvailableRoute[] = [
  { path: "/", label: "Home", category: "main" },
  { path: "/login", label: "Login", category: "auth" },
  { path: "/learn", label: "Learning Dashboard", category: "auth" },
  { path: "/profile", label: "Profile", category: "auth" },
  { path: "/profile/public/[userId]", label: "Public Profile", category: "auth" },
  { path: "/my-learning", label: "My Learning", category: "auth" },
  { path: "/search", label: "Search", category: "main" },
  { path: "/all-courses", label: "All Courses", category: "courses" },
  { path: "/self-paced", label: "Self-Paced Courses", category: "courses" },
  { path: "/books", label: "Books", category: "books" },
  { path: "/edit", label: "Edit Mode", category: "main" },
  { path: "/testimonials", label: "Testimonials", category: "main" },
  { path: "/subscribe", label: "Subscribe", category: "auth" },
  { path: "/account/subscription", label: "Subscription Management", category: "auth" },
];
