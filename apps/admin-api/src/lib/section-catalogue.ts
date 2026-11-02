/**
 * The section vocabulary a page can be built from.
 *
 * MIRRORED FROM @open-mtlms/shared/src/constants/sections.ts. The portal owns the
 * renderer, so that file is the source of truth; this is a copy for the
 * backend, which is a separate repository. Keep the two in sync, the same
 * arrangement as src/lib/creator-intent/types.ts.
 *
 * WHY THE AGENT NEEDS THIS
 * ------------------------
 * website.pages.update tells the model "never invent a section type" and then
 * never said which types exist. The result: the assistant could only ever echo
 * back sections a page already had. It could edit words, but it could not ADD
 * a hero, a stats counter, a testimonial wall or a course grid, so it could
 * not build a page, only tweak one. This list is what makes building possible.
 */
export interface SectionTypeInfo {
  type: string;
  name: string;
  description: string;
  category: string;
}

export const SECTION_TYPES: SectionTypeInfo[] = [
  {
    "type": "hero",
    "name": "Hero",
    "description": "Main hero section",
    "category": "hero"
  },
  {
    "type": "hero-code-tech",
    "name": "Hero: Code & Tech",
    "description": "Dark, immersive hero for coding and technology platforms",
    "category": "hero"
  },
  {
    "type": "ai-interview-code-tech",
    "name": "AI Mock Interview: Code & Tech",
    "description": "AI-powered mock interview section with upload panel, chat preview, steps, and tips",
    "category": "features"
  },
  {
    "type": "ai-blog-code-tech",
    "name": "AI Blogging: Code & Tech",
    "description": "AI-powered blog editor showcase with feature cards, SEO stats, and moderation",
    "category": "features"
  },
  {
    "type": "ai-chat-code-tech",
    "name": "AI Chat: Code & Tech",
    "description": "AI chat interface showcase with multi-model support, bento feature grid",
    "category": "features"
  },
  {
    "type": "jobs-code-tech",
    "name": "Jobs: Code & Tech",
    "description": "Job board showcase with search, listings, and platform aggregation",
    "category": "features"
  },
  {
    "type": "ai-resume-code-tech",
    "name": "AI Resume Builder: Code & Tech",
    "description": "AI-powered resume builder with ATS scoring, upload zone, and feature bento grid",
    "category": "features"
  },
  {
    "type": "ai-language-code-tech",
    "name": "Language AI Practice: Code & Tech",
    "description": "AI-powered language speaking practice with chat, scenarios, and real-time corrections",
    "category": "features"
  },
  {
    "type": "testimonials-scroll-code-tech",
    "name": "Testimonials Scroll: Code & Tech",
    "description": "Auto-scrolling testimonial screenshots in two rows with live data from API",
    "category": "social-proof"
  },
  {
    "type": "custom-html",
    "name": "Custom HTML",
    "description": "Your own HTML/CSS/JS in a sandboxed block",
    "category": "content"
  },
  {
    "type": "features-grid",
    "name": "Features Grid",
    "description": "Features in a grid layout",
    "category": "features"
  },
  {
    "type": "features-list",
    "name": "Features List",
    "description": "Features in a list layout",
    "category": "features"
  },
  {
    "type": "features-tabs",
    "name": "Features Tabs",
    "description": "Features with tab navigation",
    "category": "features"
  },
  {
    "type": "features-accordion",
    "name": "Features Accordion",
    "description": "Expandable feature sections",
    "category": "features"
  },
  {
    "type": "testimonials-carousel",
    "name": "Testimonials Carousel",
    "description": "Sliding testimonials",
    "category": "social-proof"
  },
  {
    "type": "testimonials-grid",
    "name": "Testimonials Grid",
    "description": "Testimonials in a grid",
    "category": "social-proof"
  },
  {
    "type": "logo-cloud",
    "name": "Logo Cloud",
    "description": "Partner/client logos",
    "category": "social-proof"
  },
  {
    "type": "stats-counter",
    "name": "Stats Counter",
    "description": "Animated statistics",
    "category": "social-proof"
  },
  {
    "type": "about",
    "name": "About",
    "description": "About section",
    "category": "content"
  },
  {
    "type": "team",
    "name": "Team",
    "description": "Team member showcase",
    "category": "content"
  },
  {
    "type": "timeline",
    "name": "Timeline",
    "description": "Chronological timeline",
    "category": "content"
  },
  {
    "type": "gallery",
    "name": "Gallery",
    "description": "Image gallery",
    "category": "content"
  },
  {
    "type": "blog-preview",
    "name": "Blog Preview",
    "description": "Recent blog posts",
    "category": "content"
  },
  {
    "type": "blog-saas-landing",
    "name": "Blog SaaS Landing",
    "description": "SaaS blog landing page",
    "category": "content"
  },
  {
    "type": "blog-saas-posts",
    "name": "Blog SaaS Posts",
    "description": "Blog posts listing",
    "category": "content"
  },
  {
    "type": "blog-saas-post-detail",
    "name": "Blog SaaS Post Detail",
    "description": "Single post detail",
    "category": "content"
  },
  {
    "type": "blog-saas-author-profile",
    "name": "Blog SaaS Author Profile",
    "description": "Author profile page",
    "category": "content"
  },
  {
    "type": "blog-saas-editor",
    "name": "Blog SaaS Editor",
    "description": "Writer dashboard and post list",
    "category": "content"
  },
  {
    "type": "blog-saas-editor-layout",
    "name": "Blog SaaS Editor Layout",
    "description": "Full editor UI shell for preview and static text",
    "category": "content"
  },
  {
    "type": "cta-banner",
    "name": "CTA Banner",
    "description": "Call-to-action banner",
    "category": "conversion"
  },
  {
    "type": "cta-split",
    "name": "CTA Split",
    "description": "Split layout CTA",
    "category": "conversion"
  },
  {
    "type": "pricing-table",
    "name": "Pricing Table",
    "description": "Pricing plans comparison",
    "category": "conversion"
  },
  {
    "type": "faq-accordion",
    "name": "FAQ Accordion",
    "description": "Frequently asked questions",
    "category": "conversion"
  },
  {
    "type": "contact-form",
    "name": "Contact Form",
    "description": "Contact form section",
    "category": "conversion"
  },
  {
    "type": "product-grid",
    "name": "Product Grid",
    "description": "Product showcase grid",
    "category": "ecommerce"
  },
  {
    "type": "course-cards",
    "name": "Course Cards",
    "description": "Course showcase",
    "category": "ecommerce"
  },
  {
    "type": "book-showcase",
    "name": "Book Showcase",
    "description": "Book/ebook showcase",
    "category": "ecommerce"
  },
  {
    "type": "all-courses-listing",
    "name": "All Courses",
    "description": "Display all published courses",
    "category": "ecommerce"
  },
  {
    "type": "live-courses-listing",
    "name": "Live Courses",
    "description": "Display live courses",
    "category": "ecommerce"
  },
  {
    "type": "self-paced-courses-listing",
    "name": "Self-Paced Courses",
    "description": "Display self-paced courses",
    "category": "ecommerce"
  },
  {
    "type": "hybrid-courses-listing",
    "name": "Hybrid Courses",
    "description": "Display hybrid courses",
    "category": "ecommerce"
  },
  {
    "type": "short-courses-listing",
    "name": "Short Courses",
    "description": "Display short courses",
    "category": "ecommerce"
  },
  {
    "type": "books-listing",
    "name": "Books",
    "description": "Display published books",
    "category": "ecommerce"
  },
  {
    "type": "bundles-listing",
    "name": "Bundles",
    "description": "Display course and book bundles",
    "category": "ecommerce"
  },
  {
    "type": "categories-listing",
    "name": "Categories",
    "description": "Display course and book categories",
    "category": "ecommerce"
  },
  {
    "type": "about-us-hero",
    "name": "About Us: Hero",
    "description": "Hero section with headline, description, and key stats",
    "category": "content"
  },
  {
    "type": "about-us-mission",
    "name": "About Us: Mission",
    "description": "Two-column mission and who-we-are blocks on dark background",
    "category": "content"
  },
  {
    "type": "about-us-offerings",
    "name": "About Us: Offerings",
    "description": "Three-column cards showcasing what you offer, with tags",
    "category": "content"
  },
  {
    "type": "about-us-values",
    "name": "About Us: Values",
    "description": "Four-column value cards highlighting core values",
    "category": "content"
  },
  {
    "type": "about-us-contact",
    "name": "About Us: Contact",
    "description": "Contact call-to-action box with email",
    "category": "conversion"
  },
  {
    "type": "contact-us-hero",
    "name": "Contact Us: Hero",
    "description": "Hero section with headline and description",
    "category": "hero"
  },
  {
    "type": "contact-us-info",
    "name": "Contact Us: Info Cards",
    "description": "Contact info cards with email, phone, and address",
    "category": "content"
  },
  {
    "type": "contact-us-form",
    "name": "Contact Us: Form",
    "description": "Contact form with illustration and FAQ sidebar",
    "category": "conversion"
  },
  {
    "type": "faq-us-hero",
    "name": "FAQ: Hero",
    "description": "Hero section with headline and description",
    "category": "hero"
  },
  {
    "type": "faq-us-list",
    "name": "FAQ: List",
    "description": "Accordion FAQ list with expandable answers",
    "category": "content"
  },
  {
    "type": "privacy-us-hero",
    "name": "Privacy: Hero",
    "description": "Hero section with headline, description, and last updated date",
    "category": "hero"
  },
  {
    "type": "privacy-us-content",
    "name": "Privacy: Content",
    "description": "Policy sections with icons, titles, and body text",
    "category": "content"
  },
  {
    "type": "terms-us-hero",
    "name": "Terms: Hero",
    "description": "Hero section with headline and description",
    "category": "hero"
  },
  {
    "type": "terms-us-content",
    "name": "Terms: Content",
    "description": "Numbered terms sections with titles and body text",
    "category": "content"
  },
  {
    "type": "subscription-hero",
    "name": "Subscription Hero",
    "description": "Hero banner for subscription landing page with stats and trust badges",
    "category": "subscription"
  },
  {
    "type": "subscription-features",
    "name": "Subscription Features",
    "description": "Feature categories showcasing what subscribers get access to",
    "category": "subscription"
  },
  {
    "type": "subscription-comparison",
    "name": "Subscription Comparison",
    "description": "Free vs paid feature comparison table",
    "category": "subscription"
  },
  {
    "type": "subscription-pricing",
    "name": "Subscription Pricing",
    "description": "Live pricing card with billing toggles, plan data from API",
    "category": "subscription"
  },
  {
    "type": "subscription-faq",
    "name": "Subscription FAQ",
    "description": "Frequently asked questions about the subscription",
    "category": "subscription"
  },
  {
    "type": "subscription-cta",
    "name": "Subscription CTA",
    "description": "Call-to-action banner encouraging subscription",
    "category": "subscription"
  },
  {
    "type": "hero-mindfulness",
    "name": "Hero: Mindfulness",
    "description": "Serene hero section with meditation imagery, wellness stats, and benefits bar",
    "category": "hero"
  },
  {
    "type": "teach-mindfulness",
    "name": "Learn: Mindfulness",
    "description": "CTA section inviting learners to start their mindfulness journey",
    "category": "conversion"
  },
  {
    "type": "how-it-works-mindfulness",
    "name": "How It Works: Mindfulness",
    "description": "Four-step process cards showing the learner journey",
    "category": "features"
  },
  {
    "type": "testimonials-mindfulness",
    "name": "Testimonials: Mindfulness",
    "description": "Horizontal scroll testimonials from learners and instructors",
    "category": "social-proof"
  },
  {
    "type": "cta-mindfulness",
    "name": "CTA: Mindfulness",
    "description": "Full-width gradient CTA section with trust badges",
    "category": "conversion"
  },
  {
    "type": "roadmap-mindfulness",
    "name": "Roadmap: Mindfulness",
    "description": "Visual journey path showing milestones toward mindfulness mastery",
    "category": "features"
  },
  {
    "type": "hero-examprep",
    "name": "Hero: IIT JEE / NEET",
    "description": "Two-column hero with badge, headline, CTA, image, and background blurs",
    "category": "hero"
  },
  {
    "type": "features-examprep",
    "name": "Features: IIT JEE / NEET",
    "description": "Six-card feature grid with colored icon accents and hover effects",
    "category": "features"
  },
  {
    "type": "learning-paths-examprep",
    "name": "Learning Paths: IIT JEE / NEET",
    "description": "Structured roadmap cards with gradient accents, checklists, and pricing",
    "category": "features"
  },
  {
    "type": "about-examprep",
    "name": "About: IIT JEE / NEET",
    "description": "Two-column about section with faculty image, credentials, and CTA",
    "category": "content"
  },
  {
    "type": "testimonials-examprep",
    "name": "Testimonials: IIT JEE / NEET",
    "description": "Success stories grid with ratings, quotes, and avatar initials",
    "category": "social-proof"
  },
  {
    "type": "faq-examprep",
    "name": "FAQ: IIT JEE / NEET",
    "description": "Accordion FAQ section with expandable question-answer pairs",
    "category": "conversion"
  },
  {
    "type": "cta-examprep",
    "name": "CTA: IIT JEE / NEET",
    "description": "Gradient call-to-action banner with headline, description, and button",
    "category": "conversion"
  },
  {
    "type": "courses-listing-examprep",
    "name": "Courses: IIT JEE / NEET",
    "description": "Course listing cards with images, ratings, pricing, and enrollment",
    "category": "ecommerce"
  },
  {
    "type": "live-courses-listing-examprep",
    "name": "Live Courses: IIT JEE / NEET",
    "description": "Live course listing cards filtered to show only live courses",
    "category": "ecommerce"
  },
  {
    "type": "self-paced-courses-listing-examprep",
    "name": "Self-Paced Courses: IIT JEE / NEET",
    "description": "Self-paced course listing cards filtered to show only self-paced courses",
    "category": "ecommerce"
  },
  {
    "type": "books-listing-examprep",
    "name": "Books: IIT JEE / NEET",
    "description": "Study materials listing with book covers, ratings, and pricing",
    "category": "ecommerce"
  },
  {
    "type": "hero-govtexam",
    "name": "Hero: Test Prep (All Govt Exams)",
    "description": "Hero section with badge, headline, description, CTA, and image",
    "category": "hero"
  },
  {
    "type": "features-govtexam",
    "name": "Features: Test Prep (All Govt Exams)",
    "description": "Feature cards grid with icons and descriptions",
    "category": "features"
  },
  {
    "type": "learning-paths-govtexam",
    "name": "Learning Paths: Test Prep (All Govt Exams)",
    "description": "Visual winding roadmap showing the structured learning journey",
    "category": "features"
  },
  {
    "type": "about-govtexam",
    "name": "About: Test Prep (All Govt Exams)",
    "description": "About section with image, credentials, and description",
    "category": "content"
  },
  {
    "type": "testimonials-govtexam",
    "name": "Testimonials: Test Prep (All Govt Exams)",
    "description": "Success stories with ratings, quotes, and avatar initials",
    "category": "social-proof"
  },
  {
    "type": "faq-govtexam",
    "name": "FAQ: Test Prep (All Govt Exams)",
    "description": "Frequently asked questions with accordion layout",
    "category": "conversion"
  },
  {
    "type": "cta-govtexam",
    "name": "CTA: Test Prep (All Govt Exams)",
    "description": "Gradient call-to-action banner with headline, description, and button",
    "category": "conversion"
  },
  {
    "type": "courses-listing-govtexam",
    "name": "Courses: Test Prep (All Govt Exams)",
    "description": "Course listing cards with images, ratings, pricing, and enrollment",
    "category": "ecommerce"
  },
  {
    "type": "live-courses-listing-govtexam",
    "name": "Live Courses: Test Prep (All Govt Exams)",
    "description": "Live course listing cards filtered to show only live courses",
    "category": "ecommerce"
  },
  {
    "type": "self-paced-courses-listing-govtexam",
    "name": "Self-Paced Courses: Test Prep (All Govt Exams)",
    "description": "Self-paced course listing cards filtered to show only self-paced courses",
    "category": "ecommerce"
  },
  {
    "type": "books-listing-govtexam",
    "name": "Books: Test Prep (All Govt Exams)",
    "description": "Study materials listing with book covers, ratings, and pricing",
    "category": "ecommerce"
  },
  {
    "type": "exam-categories-govtexam",
    "name": "Exam Categories: Test Prep (All Govt Exams)",
    "description": "Exam category cards grid with icons, titles, and descriptions",
    "category": "features"
  },
  {
    "type": "trusted-by-govtexam",
    "name": "Trusted By: Test Prep (All Govt Exams)",
    "description": "Dark-background scrolling marquee of trusted institutions and brands",
    "category": "social-proof"
  },
  {
    "type": "hero-corpupskill",
    "name": "Hero: Corporate Upskilling",
    "description": "Full-width hero with image, badge, headline, description, and CTA",
    "category": "hero"
  },
  {
    "type": "trusted-by-corpupskill",
    "name": "Trusted By: Corporate Upskilling",
    "description": "Dark bar with scrolling company logos",
    "category": "social-proof"
  },
  {
    "type": "features-split-corpupskill",
    "name": "Features Split: Corporate Upskilling",
    "description": "Two-column split layout with icons, headlines, and checklists",
    "category": "features"
  },
  {
    "type": "live-courses-listing-corpupskill",
    "name": "Live Courses: Corporate Upskilling",
    "description": "Live course listing cards",
    "category": "ecommerce"
  },
  {
    "type": "self-paced-courses-listing-corpupskill",
    "name": "Self-Paced Courses: Corporate Upskilling",
    "description": "Self-paced course listing cards",
    "category": "ecommerce"
  },
  {
    "type": "books-listing-corpupskill",
    "name": "Books: Corporate Upskilling",
    "description": "Books and study materials listing",
    "category": "ecommerce"
  },
  {
    "type": "analytics-corpupskill",
    "name": "Analytics: Corporate Upskilling",
    "description": "Dark section with progress highlights and stats grid",
    "category": "features"
  },
  {
    "type": "testimonials-corpupskill",
    "name": "Testimonials: Corporate Upskilling",
    "description": "Horizontal scrolling employee success stories",
    "category": "social-proof"
  },
  {
    "type": "cta-corpupskill",
    "name": "CTA: Corporate Upskilling",
    "description": "Full-width CTA with optional background image, headline, and trust badges",
    "category": "conversion"
  },
  {
    "type": "solutions-grid-corpupskill",
    "name": "Solutions Grid: Corporate Upskilling",
    "description": "Masonry grid of course category cards with images and ratings",
    "category": "content"
  }
];
