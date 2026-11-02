import type { SectionType } from "../types/section";

export interface SectionDefinition {
  type: SectionType;
  name: string;
  description: string;
  category: SectionCategory;
  icon: string;
  variants: SectionVariant[];
}

export interface SectionVariant {
  id: string;
  name: string;
  description: string;
}

export type SectionCategory =
  | "navigation"
  | "hero"
  | "features"
  | "social-proof"
  | "content"
  | "conversion"
  | "ecommerce"
  | "subscription";

export const SECTION_CATEGORIES: { id: SectionCategory; name: string; description: string }[] = [
  { id: "navigation", name: "Navigation", description: "Headers and footers" },
  { id: "hero", name: "Hero", description: "Hero sections and banners" },
  { id: "features", name: "Features", description: "Feature showcases" },
  { id: "social-proof", name: "Social Proof", description: "Testimonials and trust signals" },
  { id: "content", name: "Content", description: "About, team, and content sections" },
  { id: "conversion", name: "Conversion", description: "CTAs, pricing, and forms" },
  { id: "ecommerce", name: "Learning Catalog", description: "Courses, books, and learning content sections" },
  { id: "subscription", name: "Subscription", description: "Subscription landing page sections" },
];

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  // Hero
  {
    type: "hero",
    name: "Hero",
    description: "Main hero section",
    category: "hero",
    icon: "layout-distribute-vertical",
    variants: [
      { id: "centered", name: "Centered", description: "Centered text with CTA" },
    ],
  },

  {
    type: "hero-code-tech",
    name: "Hero: Code & Tech",
    description: "Dark, immersive hero for coding and technology platforms",
    category: "hero",
    icon: "code-2",
    variants: [
      { id: "default", name: "Default", description: "Two-column layout with code editor visual" },
    ],
  },

  {
    type: "testimonials-scroll-code-tech",
    name: "Testimonials Scroll: Code & Tech",
    description: "Auto-scrolling testimonial screenshots in two rows with live data from API",
    category: "social-proof",
    icon: "message-circle",
    variants: [
      { id: "default", name: "Default", description: "Two-row infinite scroll with screenshot cards" },
    ],
  },

  // Features
  {
    type: "custom-html",
    name: "Custom HTML",
    description: "Your own HTML/CSS/JS in a sandboxed block",
    category: "content",
    icon: "code",
    variants: [
      { id: "default", name: "Default", description: "Sandboxed custom code block" },
    ],
  },
  {
    type: "features-grid",
    name: "Features Grid",
    description: "Features in a grid layout",
    category: "features",
    icon: "grid-dots",
    variants: [
      { id: "3-col", name: "3 Columns", description: "Three column grid" },
      { id: "4-col", name: "4 Columns", description: "Four column grid" },
      { id: "icon-top", name: "Icon Top", description: "Icons above text" },
      { id: "icon-left", name: "Icon Left", description: "Icons beside text" },
    ],
  },
  {
    type: "features-list",
    name: "Features List",
    description: "Features in a list layout",
    category: "features",
    icon: "list",
    variants: [
      { id: "alternating", name: "Alternating", description: "Alternating left/right" },
      { id: "stacked", name: "Stacked", description: "Vertically stacked" },
    ],
  },
  {
    type: "features-tabs",
    name: "Features Tabs",
    description: "Features with tab navigation",
    category: "features",
    icon: "layout-list",
    variants: [
      { id: "horizontal", name: "Horizontal Tabs", description: "Tabs on top" },
      { id: "vertical", name: "Vertical Tabs", description: "Tabs on side" },
    ],
  },
  {
    type: "features-accordion",
    name: "Features Accordion",
    description: "Expandable feature sections",
    category: "features",
    icon: "layout-rows",
    variants: [
      { id: "simple", name: "Simple", description: "Basic accordion" },
      { id: "with-icons", name: "With Icons", description: "Accordion with icons" },
    ],
  },

  // Social Proof
  {
    type: "testimonials-carousel",
    name: "Testimonials Carousel",
    description: "Sliding testimonials",
    category: "social-proof",
    icon: "carousel-horizontal",
    variants: [
      { id: "single", name: "Single", description: "One testimonial at a time" },
      { id: "multiple", name: "Multiple", description: "Multiple visible" },
      { id: "cards", name: "Cards", description: "Card-style carousel" },
    ],
  },
  {
    type: "testimonials-grid",
    name: "Testimonials Grid",
    description: "Testimonials in a grid",
    category: "social-proof",
    icon: "grid-3x3",
    variants: [
      { id: "masonry", name: "Masonry", description: "Masonry layout" },
      { id: "uniform", name: "Uniform", description: "Equal height cards" },
    ],
  },
  {
    type: "logo-cloud",
    name: "Logo Cloud",
    description: "Partner/client logos",
    category: "social-proof",
    icon: "building",
    variants: [
      { id: "simple", name: "Simple", description: "Static logo row" },
      { id: "scrolling", name: "Scrolling", description: "Auto-scrolling logos" },
      { id: "grid", name: "Grid", description: "Logo grid layout" },
    ],
  },
  {
    type: "stats-counter",
    name: "Stats Counter",
    description: "Animated statistics",
    category: "social-proof",
    icon: "chart-bar",
    variants: [
      { id: "inline", name: "Inline", description: "Horizontal stats" },
      { id: "cards", name: "Cards", description: "Stats in cards" },
      { id: "large", name: "Large", description: "Big number display" },
    ],
  },

  // Content
  {
    type: "about",
    name: "About",
    description: "About section",
    category: "content",
    icon: "info-circle",
    variants: [
      { id: "simple", name: "Simple", description: "Text only" },
      { id: "with-image", name: "With Image", description: "Text with image" },
      { id: "with-stats", name: "With Stats", description: "Include statistics" },
    ],
  },
  {
    type: "founders",
    name: "Founders",
    description: "The founder and co founders, with photo, role and a short bio",
    category: "content",
    icon: "users",
    variants: [
      { id: "default", name: "Default", description: "Large cards with bios" },
    ],
  },
  {
    type: "team",
    name: "Team",
    description: "Team member showcase",
    category: "content",
    icon: "users",
    variants: [
      { id: "grid", name: "Grid", description: "Team member grid" },
      { id: "carousel", name: "Carousel", description: "Sliding team cards" },
      { id: "detailed", name: "Detailed", description: "With bios" },
    ],
  },
  {
    type: "timeline",
    name: "Timeline",
    description: "Chronological timeline",
    category: "content",
    icon: "timeline",
    variants: [
      { id: "vertical", name: "Vertical", description: "Vertical timeline" },
      { id: "horizontal", name: "Horizontal", description: "Horizontal timeline" },
      { id: "alternating", name: "Alternating", description: "Zigzag layout" },
    ],
  },
  {
    type: "gallery",
    name: "Gallery",
    description: "Image gallery",
    category: "content",
    icon: "photo",
    variants: [
      { id: "grid", name: "Grid", description: "Image grid" },
      { id: "masonry", name: "Masonry", description: "Masonry layout" },
      { id: "lightbox", name: "Lightbox", description: "With lightbox" },
    ],
  },

  // Conversion
  {
    type: "cta-banner",
    name: "CTA Banner",
    description: "Call-to-action banner",
    category: "conversion",
    icon: "speakerphone",
    variants: [
      { id: "simple", name: "Simple", description: "Basic CTA" },
      { id: "gradient", name: "Gradient", description: "With gradient" },
      { id: "with-image", name: "With Image", description: "Include image" },
    ],
  },
  {
    type: "cta-split",
    name: "CTA Split",
    description: "Split layout CTA",
    category: "conversion",
    icon: "layout-columns",
    variants: [
      { id: "image-left", name: "Image Left", description: "Image on left" },
      { id: "image-right", name: "Image Right", description: "Image on right" },
    ],
  },
  {
    type: "pricing-table",
    name: "Pricing Table",
    description: "Pricing plans comparison",
    category: "conversion",
    icon: "currency-dollar",
    variants: [
      { id: "cards", name: "Cards", description: "Pricing cards" },
      { id: "table", name: "Table", description: "Comparison table" },
      { id: "toggle", name: "Toggle", description: "Monthly/yearly toggle" },
    ],
  },
  {
    type: "faq-accordion",
    name: "FAQ Accordion",
    description: "Frequently asked questions",
    category: "conversion",
    icon: "help",
    variants: [
      { id: "simple", name: "Simple", description: "Basic FAQ" },
      { id: "categorized", name: "Categorized", description: "With categories" },
      { id: "search", name: "Searchable", description: "With search" },
    ],
  },
  {
    type: "contact-form",
    name: "Contact Form",
    description: "Contact form section",
    category: "conversion",
    icon: "mail",
    variants: [
      { id: "simple", name: "Simple", description: "Basic form" },
      { id: "with-info", name: "With Info", description: "Form with contact info" },
      { id: "split", name: "Split", description: "Split layout" },
    ],
  },

  {
    type: "course-cards",
    name: "Course Cards",
    description: "Course showcase",
    category: "ecommerce",
    icon: "school",
    variants: [
      { id: "grid", name: "Grid", description: "Responsive grid layout (max 8 items)" },
      { id: "scroll", name: "Scroll", description: "Horizontal scroll layout" },
    ],
  },
  {
    type: "book-showcase",
    name: "Book Showcase",
    description: "Book/ebook showcase",
    category: "ecommerce",
    icon: "book",
    variants: [
      { id: "grid", name: "Grid", description: "Responsive grid layout (max 8 items)" },
      { id: "scroll", name: "Scroll", description: "Horizontal scroll layout" },
    ],
  },
  // Content Listing sections
  {
    type: "all-courses-listing",
    name: "All Courses",
    description: "Display all published courses",
    category: "ecommerce",
    icon: "graduation-cap",
    variants: [
      { id: "scroll", name: "Scroll", description: "Horizontal scroll with arrow navigation" },
      { id: "grid", name: "Grid", description: "Responsive grid layout" },
      { id: "row", name: "Row", description: "Centered horizontal row" },
    ],
  },
  {
    type: "self-paced-courses-listing",
    name: "Self-Paced Courses",
    description: "Display self-paced courses",
    category: "ecommerce",
    icon: "play-circle",
    variants: [
      { id: "scroll", name: "Scroll", description: "Horizontal scroll with arrow navigation" },
      { id: "grid", name: "Grid", description: "Responsive grid layout" },
      { id: "row", name: "Row", description: "Centered horizontal row" },
    ],
  },
  {
    type: "books-listing",
    name: "Books",
    description: "Display published books",
    category: "ecommerce",
    icon: "book-open",
    variants: [
      { id: "scroll", name: "Scroll", description: "Horizontal scroll with arrow navigation" },
      { id: "grid", name: "Grid", description: "Responsive grid layout" },
      { id: "row", name: "Row", description: "Centered horizontal row" },
    ],
  },
  {
    type: "bundles-listing",
    name: "Bundles",
    description: "Display course and book bundles",
    category: "ecommerce",
    icon: "package",
    variants: [
      { id: "scroll", name: "Scroll", description: "Horizontal scroll with arrow navigation" },
      { id: "grid", name: "Grid", description: "Responsive grid layout" },
      { id: "row", name: "Row", description: "Centered horizontal row" },
    ],
  },
  {
    type: "categories-listing",
    name: "Categories",
    description: "Display course and book categories",
    category: "ecommerce",
    icon: "grid-3x3",
    variants: [
      { id: "scroll", name: "Scroll", description: "Horizontal scroll with arrow navigation" },
      { id: "grid", name: "Grid", description: "Responsive grid layout" },
      { id: "row", name: "Row", description: "Centered horizontal row" },
    ],
  },
  // About Us Page Sections
  {
    type: "about-us-hero",
    name: "About Us: Hero",
    description: "Hero section with headline, description, and key stats",
    category: "content",
    icon: "info",
    variants: [
      { id: "default", name: "Default", description: "Centered hero with stats row" },
    ],
  },
  {
    type: "about-us-mission",
    name: "About Us: Mission",
    description: "Two-column mission and who-we-are blocks on dark background",
    category: "content",
    icon: "target",
    variants: [
      { id: "default", name: "Default", description: "Two-column dark layout" },
    ],
  },
  {
    type: "about-us-offerings",
    name: "About Us: Offerings",
    description: "Three-column cards showcasing what you offer, with tags",
    category: "content",
    icon: "monitor",
    variants: [
      { id: "default", name: "Default", description: "Three-column card grid" },
    ],
  },
  {
    type: "about-us-values",
    name: "About Us: Values",
    description: "Four-column value cards highlighting core values",
    category: "content",
    icon: "heart",
    variants: [
      { id: "default", name: "Default", description: "Four-column card grid" },
    ],
  },
  {
    type: "about-us-contact",
    name: "About Us: Contact",
    description: "Contact call-to-action box with email",
    category: "conversion",
    icon: "mail",
    variants: [
      { id: "default", name: "Default", description: "Dark contact box with email" },
    ],
  },
  // Contact Us Page Sections
  {
    type: "contact-us-hero",
    name: "Contact Us: Hero",
    description: "Hero section with headline and description",
    category: "hero",
    icon: "mail",
    variants: [
      { id: "default", name: "Default", description: "Centered hero" },
    ],
  },
  {
    type: "contact-us-info",
    name: "Contact Us: Info Cards",
    description: "Contact info cards with email, phone, and address",
    category: "content",
    icon: "contact",
    variants: [
      { id: "default", name: "Default", description: "Three-column cards" },
    ],
  },
  {
    type: "contact-us-form",
    name: "Contact Us: Form",
    description: "Contact form with illustration and FAQ sidebar",
    category: "conversion",
    icon: "send",
    variants: [
      { id: "default", name: "Default", description: "Form with FAQ sidebar" },
    ],
  },
  // FAQ Page Sections
  {
    type: "faq-us-hero",
    name: "FAQ: Hero",
    description: "Hero section with headline and description",
    category: "hero",
    icon: "help-circle",
    variants: [
      { id: "default", name: "Default", description: "Centered hero" },
    ],
  },
  {
    type: "faq-us-list",
    name: "FAQ: List",
    description: "Accordion FAQ list with expandable answers",
    category: "content",
    icon: "list",
    variants: [
      { id: "default", name: "Default", description: "Simple accordion" },
    ],
  },
  // Privacy Policy Page Sections
  {
    type: "privacy-us-hero",
    name: "Privacy: Hero",
    description: "Hero section with headline, description, and last updated date",
    category: "hero",
    icon: "shield",
    variants: [
      { id: "default", name: "Default", description: "Centered hero" },
    ],
  },
  {
    type: "privacy-us-content",
    name: "Privacy: Content",
    description: "Policy sections with icons, titles, and body text",
    category: "content",
    icon: "file-text",
    variants: [
      { id: "default", name: "Default", description: "Card-based sections" },
    ],
  },
  // Terms of Service Page Sections
  {
    type: "terms-us-hero",
    name: "Terms: Hero",
    description: "Hero section with headline and description",
    category: "hero",
    icon: "file-text",
    variants: [
      { id: "default", name: "Default", description: "Centered hero" },
    ],
  },
  {
    type: "terms-us-content",
    name: "Terms: Content",
    description: "Numbered terms sections with titles and body text",
    category: "content",
    icon: "list-ordered",
    variants: [
      { id: "default", name: "Default", description: "Numbered card sections" },
    ],
  },
  // Subscription Page Sections
  {
    type: "subscription-hero",
    name: "Subscription Hero",
    description: "Hero banner for subscription landing page with stats and trust badges",
    category: "subscription",
    icon: "crown",
    variants: [
      { id: "default", name: "Default", description: "Full-width hero with stats" },
    ],
  },
  {
    type: "subscription-features",
    name: "Subscription Features",
    description: "Feature categories showcasing what subscribers get access to",
    category: "subscription",
    icon: "sparkles",
    variants: [
      { id: "default", name: "Default", description: "Category groups with feature lists" },
    ],
  },
  {
    type: "subscription-comparison",
    name: "Subscription Comparison",
    description: "Free vs paid feature comparison table",
    category: "subscription",
    icon: "table",
    variants: [
      { id: "default", name: "Default", description: "Two-column comparison table" },
    ],
  },
  {
    type: "subscription-pricing",
    name: "Subscription Pricing",
    description: "Live pricing card with billing toggles, plan data from API",
    category: "subscription",
    icon: "credit-card",
    variants: [
      { id: "default", name: "Default", description: "Pricing card with toggles" },
    ],
  },
  {
    type: "subscription-faq",
    name: "Subscription FAQ",
    description: "Frequently asked questions about the subscription",
    category: "subscription",
    icon: "help-circle",
    variants: [
      { id: "default", name: "Default", description: "Accordion FAQ list" },
    ],
  },
  {
    type: "subscription-cta",
    name: "Subscription CTA",
    description: "Call-to-action banner encouraging subscription",
    category: "subscription",
    icon: "zap",
    variants: [
      { id: "default", name: "Default", description: "CTA banner with button" },
    ],
  },

  // Mindfulness Template Sections
  {
    type: "hero-mindfulness",
    name: "Hero: Mindfulness",
    description: "Serene hero section with meditation imagery, wellness stats, and benefits bar",
    category: "hero",
    icon: "heart",
    variants: [
      { id: "default", name: "Default", description: "Two-column layout with image and stats" },
    ],
  },
  {
    type: "teach-mindfulness",
    name: "Learn: Mindfulness",
    description: "CTA section inviting learners to start their mindfulness journey",
    category: "conversion",
    icon: "presentation",
    variants: [
      { id: "default", name: "Default", description: "Two-column card with meditation illustration and CTA" },
    ],
  },
  {
    type: "how-it-works-mindfulness",
    name: "How It Works: Mindfulness",
    description: "Four-step process cards showing the learner journey",
    category: "features",
    icon: "list-checks",
    variants: [
      { id: "default", name: "Default", description: "Four-column step cards with icons" },
    ],
  },
  {
    type: "testimonials-mindfulness",
    name: "Testimonials: Mindfulness",
    description: "Horizontal scroll testimonials from learners and instructors",
    category: "social-proof",
    icon: "message-circle",
    variants: [
      { id: "default", name: "Default", description: "Horizontal scroll with role badges" },
    ],
  },
  {
    type: "cta-mindfulness",
    name: "CTA: Mindfulness",
    description: "Full-width gradient CTA section with trust badges",
    category: "conversion",
    icon: "sparkles",
    variants: [
      { id: "default", name: "Default", description: "Gradient background with centered CTA" },
    ],
  },
  {
    type: "roadmap-mindfulness",
    name: "Roadmap: Mindfulness",
    description: "Visual journey path showing milestones toward mindfulness mastery",
    category: "features",
    icon: "route",
    variants: [
      { id: "default", name: "Default", description: "Vertical timeline path with milestone cards" },
    ],
  },
  // Exam Prep Template Sections
  {
    type: "hero-examprep",
    name: "Hero: IIT JEE / NEET",
    description: "Two-column hero with badge, headline, CTA, image, and background blurs",
    category: "hero",
    icon: "graduation-cap",
    variants: [
      { id: "default", name: "Default", description: "Split layout with image and stats" },
    ],
  },
  {
    type: "features-examprep",
    name: "Features: IIT JEE / NEET",
    description: "Six-card feature grid with colored icon accents and hover effects",
    category: "features",
    icon: "layout-grid",
    variants: [
      { id: "default", name: "Default", description: "3-column responsive grid" },
    ],
  },
  {
    type: "learning-paths-examprep",
    name: "Learning Paths: IIT JEE / NEET",
    description: "Structured roadmap cards with gradient accents, checklists, and pricing",
    category: "features",
    icon: "route",
    variants: [
      { id: "default", name: "Default", description: "Three-column path cards" },
    ],
  },
  {
    type: "about-examprep",
    name: "About: IIT JEE / NEET",
    description: "Two-column about section with faculty image, credentials, and CTA",
    category: "content",
    icon: "users",
    variants: [
      { id: "default", name: "Default", description: "Image left, content right layout" },
    ],
  },
  {
    type: "testimonials-examprep",
    name: "Testimonials: IIT JEE / NEET",
    description: "Success stories grid with ratings, quotes, and avatar initials",
    category: "social-proof",
    icon: "message-square",
    variants: [
      { id: "default", name: "Default", description: "Three-column testimonial cards" },
    ],
  },
  {
    type: "faq-examprep",
    name: "FAQ: IIT JEE / NEET",
    description: "Accordion FAQ section with expandable question-answer pairs",
    category: "conversion",
    icon: "help-circle",
    variants: [
      { id: "default", name: "Default", description: "Centered accordion layout" },
    ],
  },
  {
    type: "cta-examprep",
    name: "CTA: IIT JEE / NEET",
    description: "Gradient call-to-action banner with headline, description, and button",
    category: "conversion",
    icon: "megaphone",
    variants: [
      { id: "default", name: "Default", description: "Full-width gradient CTA" },
    ],
  },
  {
    type: "courses-listing-examprep",
    name: "Courses: IIT JEE / NEET",
    description: "Course listing cards with images, ratings, pricing, and enrollment",
    category: "ecommerce",
    icon: "book-open",
    variants: [
      { id: "default", name: "Default", description: "Three-column course cards" },
    ],
  },
  {
    type: "self-paced-courses-listing-examprep",
    name: "Self-Paced Courses: IIT JEE / NEET",
    description: "Self-paced course listing cards filtered to show only self-paced courses",
    category: "ecommerce",
    icon: "play-circle",
    variants: [
      { id: "default", name: "Default", description: "Three-column self-paced course cards" },
    ],
  },
  {
    type: "books-listing-examprep",
    name: "Books: IIT JEE / NEET",
    description: "Study materials listing with book covers, ratings, and pricing",
    category: "ecommerce",
    icon: "book",
    variants: [
      { id: "default", name: "Default", description: "Four-column book cards" },
    ],
  },
  // Test Prep (All Govt Exams) Template Sections
  {
    type: "hero-govtexam",
    name: "Hero: Test Prep (All Govt Exams)",
    description: "Hero section with badge, headline, description, CTA, and image",
    category: "hero",
    icon: "graduation-cap",
    variants: [
      { id: "default", name: "Default", description: "Split layout with image" },
    ],
  },
  {
    type: "features-govtexam",
    name: "Features: Test Prep (All Govt Exams)",
    description: "Feature cards grid with icons and descriptions",
    category: "features",
    icon: "grid",
    variants: [
      { id: "default", name: "Default", description: "Six-card grid layout" },
    ],
  },
  {
    type: "learning-paths-govtexam",
    name: "Learning Paths: Test Prep (All Govt Exams)",
    description: "Visual winding roadmap showing the structured learning journey",
    category: "features",
    icon: "route",
    variants: [
      { id: "default", name: "Default", description: "Winding path with waypoint markers" },
    ],
  },
  {
    type: "about-govtexam",
    name: "About: Test Prep (All Govt Exams)",
    description: "About section with image, credentials, and description",
    category: "content",
    icon: "users",
    variants: [
      { id: "default", name: "Default", description: "Image left, content right layout" },
    ],
  },
  {
    type: "testimonials-govtexam",
    name: "Testimonials: Test Prep (All Govt Exams)",
    description: "Success stories with ratings, quotes, and avatar initials",
    category: "social-proof",
    icon: "message-square",
    variants: [
      { id: "default", name: "Default", description: "Scrolling testimonial cards" },
    ],
  },
  {
    type: "faq-govtexam",
    name: "FAQ: Test Prep (All Govt Exams)",
    description: "Frequently asked questions with accordion layout",
    category: "conversion",
    icon: "help-circle",
    variants: [
      { id: "default", name: "Default", description: "Centered accordion layout" },
    ],
  },
  {
    type: "cta-govtexam",
    name: "CTA: Test Prep (All Govt Exams)",
    description: "Gradient call-to-action banner with headline, description, and button",
    category: "conversion",
    icon: "megaphone",
    variants: [
      { id: "default", name: "Default", description: "Full-width gradient CTA" },
    ],
  },
  {
    type: "courses-listing-govtexam",
    name: "Courses: Test Prep (All Govt Exams)",
    description: "Course listing cards with images, ratings, pricing, and enrollment",
    category: "ecommerce",
    icon: "book-open",
    variants: [
      { id: "default", name: "Default", description: "Three-column course cards" },
    ],
  },
  {
    type: "self-paced-courses-listing-govtexam",
    name: "Self-Paced Courses: Test Prep (All Govt Exams)",
    description: "Self-paced course listing cards filtered to show only self-paced courses",
    category: "ecommerce",
    icon: "play-circle",
    variants: [
      { id: "default", name: "Default", description: "Three-column self-paced course cards" },
    ],
  },
  {
    type: "books-listing-govtexam",
    name: "Books: Test Prep (All Govt Exams)",
    description: "Study materials listing with book covers, ratings, and pricing",
    category: "ecommerce",
    icon: "book",
    variants: [
      { id: "default", name: "Default", description: "Four-column book cards" },
    ],
  },
  {
    type: "exam-categories-govtexam",
    name: "Exam Categories: Test Prep (All Govt Exams)",
    description: "Exam category cards grid with icons, titles, and descriptions",
    category: "features",
    icon: "layout-grid",
    variants: [
      { id: "default", name: "Default", description: "Four-column category cards" },
    ],
  },
  {
    type: "trusted-by-govtexam",
    name: "Trusted By: Test Prep (All Govt Exams)",
    description: "Dark-background scrolling marquee of trusted institutions and brands",
    category: "social-proof",
    icon: "award",
    variants: [
      { id: "default", name: "Default", description: "Infinite scrolling logo marquee" },
    ],
  },
  // ── Corporate Upskilling Template ──
  {
    type: "hero-corpupskill",
    name: "Hero: Corporate Upskilling",
    description: "Full-width hero with image, badge, headline, description, and CTA",
    category: "hero",
    icon: "layout",
    variants: [{ id: "default", name: "Default", description: "Image hero with overlay text" }],
  },
  {
    type: "trusted-by-corpupskill",
    name: "Trusted By: Corporate Upskilling",
    description: "Dark bar with scrolling company logos",
    category: "social-proof",
    icon: "award",
    variants: [{ id: "default", name: "Default", description: "Scrolling logo marquee" }],
  },
  {
    type: "features-split-corpupskill",
    name: "Features Split: Corporate Upskilling",
    description: "Two-column split layout with icons, headlines, and checklists",
    category: "features",
    icon: "columns",
    variants: [{ id: "default", name: "Default", description: "Side-by-side feature columns" }],
  },
  {
    type: "self-paced-courses-listing-corpupskill",
    name: "Self-Paced Courses: Corporate Upskilling",
    description: "Self-paced course listing cards",
    category: "ecommerce",
    icon: "play-circle",
    variants: [{ id: "default", name: "Default", description: "Course cards grid" }],
  },
  {
    type: "books-listing-corpupskill",
    name: "Books: Corporate Upskilling",
    description: "Books and study materials listing",
    category: "ecommerce",
    icon: "book",
    variants: [{ id: "default", name: "Default", description: "Book cards grid" }],
  },
  {
    type: "analytics-corpupskill",
    name: "Analytics: Corporate Upskilling",
    description: "Dark section with progress highlights and stats grid",
    category: "features",
    icon: "bar-chart",
    variants: [{ id: "default", name: "Default", description: "Stats and highlights layout" }],
  },
  {
    type: "testimonials-corpupskill",
    name: "Testimonials: Corporate Upskilling",
    description: "Horizontal scrolling employee success stories",
    category: "social-proof",
    icon: "message-square",
    variants: [{ id: "default", name: "Default", description: "Scrolling testimonial cards" }],
  },
  {
    type: "cta-corpupskill",
    name: "CTA: Corporate Upskilling",
    description: "Full-width CTA with optional background image, headline, and trust badges",
    category: "conversion",
    icon: "megaphone",
    variants: [{ id: "default", name: "Default", description: "Full-width dark CTA" }],
  },
  {
    type: "solutions-grid-corpupskill",
    name: "Solutions Grid: Corporate Upskilling",
    description: "Masonry grid of course category cards with images and ratings",
    category: "content",
    icon: "layout-grid",
    variants: [{ id: "default", name: "Default", description: "Masonry card grid" }],
  },
];

/**
 * Get section definition by type
 */
export function getSectionDefinition(type: SectionType): SectionDefinition | undefined {
  return SECTION_DEFINITIONS.find((def) => def.type === type);
}

/**
 * Get sections by category
 */
export function getSectionsByCategory(category: SectionCategory): SectionDefinition[] {
  return SECTION_DEFINITIONS.filter((def) => def.category === category);
}

/**
 * Get variant by section type and variant id
 */
export function getSectionVariant(
  type: SectionType,
  variantId: string
): SectionVariant | undefined {
  const definition = getSectionDefinition(type);
  return definition?.variants.find((v) => v.id === variantId);
}
