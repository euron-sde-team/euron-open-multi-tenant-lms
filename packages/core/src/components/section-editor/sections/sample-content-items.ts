import type { ContentListingItem } from "@open-mtlms/shared";

/**
 * Sample (placeholder) catalog data for the EDITOR ONLY.
 *
 * When a catalog listing (courses, books, test-series, 1:1, …) has no published
 * data yet, the live site hides the section, but the editor renders these
 * realistic sample cards instead, so a tenant can see how the section will look
 * once real content is published. Never shown on the live/preview page (callers
 * gate this on `isEditMode`).
 *
 * Thumbnails are intentionally omitted, every card component already renders a
 * themed fallback for missing images, so samples inherit the template's styling
 * automatically and we avoid depending on any external image host.
 */

// Local copy of the section-type → card-type mapping (kept in sync with
// ContentListingSection.getCardType) so this helper stays self-contained.
function resolveSampleCardType(
  sectionType: string,
): "course" | "book" | "bundle" | "category" | "test-series" {
  if (sectionType.includes("test-series")) return "test-series";
  if (sectionType.includes("courses") || sectionType === "course-cards") return "course";
  if (sectionType.includes("books") || sectionType === "book-showcase") return "book";
  if (sectionType.includes("bundles")) return "bundle";
  if (sectionType.includes("categories")) return "category";
  return "course";
}

const SAMPLE_COURSES: ContentListingItem[] = [
  {
    id: "sample-course-1",
    type: "course",
    title: "Complete Web Development Bootcamp",
    slug: "sample-web-development",
    subtitle: "From zero to full-stack developer",
    description: "Build real-world projects with HTML, CSS, JavaScript, React and Node.",
    thumbnailUrl: null,
    priceInr: "4999",
    priceUsd: "79",
    discountInr: "1999",
    discountUsd: "29",
    purchaseMode: "PAID",
    mode: "SELF_PACED",
    difficulty: "Beginner",
    duration: "42h",
    instructor: { id: "sample-i-1", name: "Ananya Sharma", avatar: null },
  },
  {
    id: "sample-course-2",
    type: "course",
    title: "Advanced Data Structures & Algorithms",
    slug: "sample-dsa",
    subtitle: "Crack technical interviews with confidence",
    description: "Master problem-solving patterns used at top product companies.",
    thumbnailUrl: null,
    priceInr: "6999",
    priceUsd: "99",
    discountInr: "3499",
    discountUsd: "49",
    purchaseMode: "PAID",
    mode: "LIVE",
    difficulty: "Advanced",
    duration: "36h",
    instructor: { id: "sample-i-2", name: "Rohan Mehta", avatar: null },
  },
  {
    id: "sample-course-3",
    type: "course",
    title: "UI/UX Design Masterclass",
    slug: "sample-ui-ux",
    subtitle: "Design products people love to use",
    description: "Learn design thinking, wireframing, and prototyping in Figma.",
    thumbnailUrl: null,
    priceInr: "3999",
    priceUsd: "59",
    discountInr: null,
    discountUsd: null,
    purchaseMode: "PAID",
    mode: "SELF_PACED",
    difficulty: "Intermediate",
    duration: "28h",
    instructor: { id: "sample-i-3", name: "Priya Nair", avatar: null },
  },
  {
    id: "sample-course-4",
    type: "course",
    title: "Python for Data Science",
    slug: "sample-python-ds",
    subtitle: "Turn data into insights",
    description: "Pandas, NumPy, visualization and an intro to machine learning.",
    thumbnailUrl: null,
    priceInr: "0",
    priceUsd: "0",
    discountInr: null,
    discountUsd: null,
    purchaseMode: "FREE",
    mode: "SELF_PACED",
    difficulty: "Beginner",
    duration: "18h",
    instructor: { id: "sample-i-4", name: "Vikram Rao", avatar: null },
  },
  {
    id: "sample-course-5",
    type: "course",
    title: "Digital Marketing Essentials",
    slug: "sample-digital-marketing",
    subtitle: "Grow any brand online",
    description: "SEO, social media, paid ads and analytics from the ground up.",
    thumbnailUrl: null,
    priceInr: "2999",
    priceUsd: "39",
    discountInr: "1499",
    discountUsd: "19",
    purchaseMode: "PAID",
    mode: "HYBRID",
    difficulty: "Beginner",
    duration: "22h",
    instructor: { id: "sample-i-5", name: "Sara Khan", avatar: null },
  },
  {
    id: "sample-course-6",
    type: "course",
    title: "Cloud & DevOps Fundamentals",
    slug: "sample-devops",
    subtitle: "Ship faster, scale smarter",
    description: "Docker, CI/CD, Kubernetes and cloud deployment basics.",
    thumbnailUrl: null,
    priceInr: "5499",
    priceUsd: "89",
    discountInr: "2999",
    discountUsd: "45",
    purchaseMode: "PAID",
    mode: "LIVE",
    difficulty: "Intermediate",
    duration: "30h",
    instructor: { id: "sample-i-6", name: "Arjun Patel", avatar: null },
  },
];

const SAMPLE_BOOKS: ContentListingItem[] = [
  {
    id: "sample-book-1",
    type: "book",
    title: "The Pragmatic Learner",
    slug: "sample-pragmatic-learner",
    description: "A practical guide to mastering any skill faster.",
    thumbnailUrl: null,
    priceInr: "799",
    priceUsd: "12",
    discountInr: "399",
    discountUsd: "6",
    purchaseMode: "PAID",
    pages: 268,
    author: "Ananya Sharma",
    authors: [{ id: "sample-a-1", name: "Ananya Sharma" }],
    language: ["English"],
  },
  {
    id: "sample-book-2",
    type: "book",
    title: "Foundations of Modern Design",
    slug: "sample-foundations-design",
    description: "Principles, patterns and case studies for great products.",
    thumbnailUrl: null,
    priceInr: "999",
    priceUsd: "15",
    discountInr: null,
    discountUsd: null,
    purchaseMode: "PAID",
    pages: 320,
    author: "Priya Nair",
    authors: [{ id: "sample-a-2", name: "Priya Nair" }],
    language: ["English"],
  },
  {
    id: "sample-book-3",
    type: "book",
    title: "Data Science Handbook",
    slug: "sample-data-science-handbook",
    description: "Everything you need to start a career in data.",
    thumbnailUrl: null,
    priceInr: "0",
    priceUsd: "0",
    discountInr: null,
    discountUsd: null,
    purchaseMode: "FREE",
    pages: 412,
    author: "Vikram Rao",
    authors: [{ id: "sample-a-3", name: "Vikram Rao" }],
    language: ["English"],
  },
  {
    id: "sample-book-4",
    type: "book",
    title: "The Growth Playbook",
    slug: "sample-growth-playbook",
    description: "Proven strategies to grow a brand from 0 to 1.",
    thumbnailUrl: null,
    priceInr: "1299",
    priceUsd: "19",
    discountInr: "649",
    discountUsd: "9",
    purchaseMode: "PAID",
    pages: 240,
    author: "Sara Khan",
    authors: [{ id: "sample-a-4", name: "Sara Khan" }],
    language: ["English"],
  },
];

const SAMPLE_BUNDLES: ContentListingItem[] = [
  {
    id: "sample-bundle-1",
    type: "bundle",
    title: "Full-Stack Career Bundle",
    slug: "sample-fullstack-bundle",
    subtitle: "Everything to become job-ready",
    description: "6 courses + 2 e-books + interview prep, at one bundled price.",
    thumbnailUrl: null,
    priceInr: "14999",
    priceUsd: "199",
    discountInr: "7999",
    discountUsd: "99",
    purchaseMode: "PAID",
    itemCount: 8,
  },
  {
    id: "sample-bundle-2",
    type: "bundle",
    title: "Design Pro Bundle",
    slug: "sample-design-bundle",
    subtitle: "From beginner to professional designer",
    description: "UI/UX masterclass, design systems and portfolio projects.",
    thumbnailUrl: null,
    priceInr: "9999",
    priceUsd: "149",
    discountInr: "4999",
    discountUsd: "69",
    purchaseMode: "PAID",
    itemCount: 5,
  },
  {
    id: "sample-bundle-3",
    type: "bundle",
    title: "Data & AI Starter Bundle",
    slug: "sample-data-ai-bundle",
    subtitle: "Kickstart your data journey",
    description: "Python, statistics, machine learning and real datasets.",
    thumbnailUrl: null,
    priceInr: "11999",
    priceUsd: "169",
    discountInr: "5999",
    discountUsd: "79",
    purchaseMode: "PAID",
    itemCount: 6,
  },
];

const SAMPLE_CATEGORIES: ContentListingItem[] = [
  {
    id: "sample-cat-1",
    type: "category",
    title: "Development",
    slug: "sample-development",
    description: "Web, mobile and software engineering",
    iconUrl: null,
  },
  {
    id: "sample-cat-2",
    type: "category",
    title: "Design",
    slug: "sample-design",
    description: "UI/UX, graphic and product design",
    iconUrl: null,
  },
  {
    id: "sample-cat-3",
    type: "category",
    title: "Data Science",
    slug: "sample-data-science",
    description: "Analytics, ML and AI",
    iconUrl: null,
  },
  {
    id: "sample-cat-4",
    type: "category",
    title: "Business",
    slug: "sample-business",
    description: "Marketing, finance and management",
    iconUrl: null,
  },
];

const SAMPLE_TEST_SERIES: ContentListingItem[] = [
  {
    id: "sample-ts-1",
    type: "test-series",
    title: "Full Mock Test Series: Foundation",
    slug: "sample-mock-foundation",
    description: "20 full-length mocks with detailed solutions and analytics.",
    thumbnailUrl: null,
    priceInr: "1499",
    priceUsd: "19",
    discountInr: "799",
    discountUsd: "9",
    purchaseMode: "PAID",
  },
  {
    id: "sample-ts-2",
    type: "test-series",
    title: "Topic-wise Practice Tests",
    slug: "sample-topicwise",
    description: "Targeted practice across every syllabus topic.",
    thumbnailUrl: null,
    priceInr: "0",
    priceUsd: "0",
    discountInr: null,
    discountUsd: null,
    purchaseMode: "FREE",
  },
  {
    id: "sample-ts-3",
    type: "test-series",
    title: "Previous Year Papers: Solved",
    slug: "sample-pyq",
    description: "10 years of papers with step-by-step explanations.",
    thumbnailUrl: null,
    priceInr: "999",
    priceUsd: "14",
    discountInr: null,
    discountUsd: null,
    purchaseMode: "PAID",
  },
];

const SAMPLES_BY_CARD_TYPE: Record<string, ContentListingItem[]> = {
  course: SAMPLE_COURSES,
  book: SAMPLE_BOOKS,
  bundle: SAMPLE_BUNDLES,
  category: SAMPLE_CATEGORIES,
  "test-series": SAMPLE_TEST_SERIES,
};

/**
 * Sample placeholder items for a listing section, sliced to `limit`.
 * Returns an editor-only preview set matched to the section's card type.
 */
export function getSampleContentItems(
  sectionType: string,
  limit: number,
): ContentListingItem[] {
  const cardType = resolveSampleCardType(sectionType);
  const items = SAMPLES_BY_CARD_TYPE[cardType] ?? SAMPLE_COURSES;
  return items.slice(0, Math.max(1, limit));
}
