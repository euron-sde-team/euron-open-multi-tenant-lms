/**
 * Built-in system pages that exist as static Next.js routes in the web app.
 * These are not stored in tenant_pages and cannot be edited via the page editor.
 * Content is driven by the LMS courses API or tenant config.
 */

export interface SystemPage {
  id: string;
  name: string;
  route: string;
  path: string;
  description: string;
  /** Optional - when omitted, only View button is shown */
  manageHref?: string;
  /** Custom label for manage button (default: "Manage Courses") */
  manageLabel?: string;
  /** Override the "Manage Courses" button label */
  manageLinkLabel?: string;
  /** When set, page is only shown if this feature is active in the tenant's plan */
  featureKey?: string;
}

export const SYSTEM_PAGES: SystemPage[] = [
  {
    id: "search",
    name: "Search",
    route: "/search",
    path: "/search",
    description: "Global search page for courses, books, and bundles.",
    manageHref: "/dashboard/search",
    manageLinkLabel: "Search",
  },
  {
    id: "learn",
    name: "Learning Dashboard",
    route: "/learn",
    path: "/learn",
    description: "Student learning dashboard. Enrolled courses, progress, and course player.",
  },
  {
    id: "my-learning",
    name: "My Learning",
    route: "/my-learning",
    path: "/my-learning",
    description: "Enrolled courses and owned books. Progress tracking and continue learning.",
  },
  {
    id: "courses",
    name: "All Courses",
    route: "/all-courses",
    path: "/all-courses",
    description: "All published courses. Infinite scroll listing.",
    manageHref: "/dashboard/courses",
    manageLabel: "Manage Courses",
  },
  {
    id: "courses-self-paced",
    name: "Self Paced Courses",
    route: "/self-paced",
    path: "/self-paced",
    description: "Built-in course listing. Displays published self-paced courses.",
    manageHref: "/dashboard/courses/self-paced",
  },
  {
    id: "books",
    name: "Books",
    route: "/books",
    path: "/books",
    description: "Built-in book listing. Displays published books.",
    manageHref: "/dashboard/books",
    manageLabel: "Manage Books",
  },
  {
    id: "bundles",
    name: "Bundles",
    route: "/bundles",
    path: "/bundles",
    description: "Built-in bundle listing. Displays published course and book bundles.",
    manageHref: "/dashboard/bundles",
    manageLabel: "Manage Bundles",
  },
  {
    id: "categories",
    name: "Categories",
    route: "/categories",
    path: "/categories",
    description: "Built-in category listing. Displays categories with courses and books.",
    manageHref: "/dashboard/categories",
    manageLabel: "Manage Categories",
  },
  {
    id: "cart",
    name: "Cart",
    route: "/cart",
    path: "/cart",
    description: "Shopping cart. Built-in commerce page.",
  },
  {
    id: "bookmark",
    name: "Bookmarks",
    route: "/bookmark",
    path: "/bookmark",
    description: "Saved bookmarks. Built-in commerce page.",
  },
];
