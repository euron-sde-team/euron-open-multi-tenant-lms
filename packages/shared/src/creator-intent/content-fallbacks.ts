import type { GeneratedAcademyBundle, TemplateId, ThemeId } from "./types";

// Curated fallback content per template, used when Gemini is unavailable
// or returns invalid output. Hand-written to feel branded and India-friendly.
type FallbackContent = Pick<
  GeneratedAcademyBundle,
  | "hero_headline"
  | "hero_subheading"
  | "sample_course_title"
  | "sample_course_description"
  | "sample_course_outcomes"
  | "faqs"
  | "about_intro_paragraph"
> & {
  ai_hints_pillars: string[];
  ai_hints_differentiators: string[];
};

const COMMON_FAQS_BASE = [
  {
    question: "How do I access the course after I enrol?",
    answer:
      "Once you enrol, you'll find the course in your dashboard under 'My Courses'. You get lifetime access and can resume from where you left off on any device.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "We offer a 7-day no-questions-asked refund window from the date of purchase. Reach out to support and we'll process it within 5–7 business days.",
  },
  {
    question: "Will I get a certificate after completion?",
    answer:
      "Yes, once you complete all modules and pass the final assessment, a verifiable certificate is issued to your email and saved on your profile.",
  },
];

const TEMPLATE_FALLBACKS: Record<TemplateId, FallbackContent> = {
  basic: {
    hero_headline: "Your craft, taught your way",
    hero_subheading:
      "Build a learning experience that matches how you teach, courses, live classes, community, all in one place.",
    sample_course_title: "Getting Started with {{orgName}}",
    sample_course_description:
      "A welcoming first course that introduces your students to your teaching style. Use this as a runway to set expectations, share your learning philosophy, and walk through the foundations they'll build on. Edit each lesson, add your videos, and customise the journey before going live.",
    sample_course_outcomes: [
      "Understand the core concepts your programme is built around",
      "Set up everything you need to start learning effectively",
      "Build the confidence to take on the next module",
    ],
    faqs: COMMON_FAQS_BASE,
    about_intro_paragraph:
      "{{orgName}} was built to give learners a focused, structured way to grow. We believe that good teaching is patient, practical, and personal, and we've put that belief into every course on this platform.",
    ai_hints_pillars: ["Foundations", "Practice", "Community"],
    ai_hints_differentiators: [
      "Personal teaching style",
      "Practical exercises",
    ],
  },
  "code-tech": {
    hero_headline: "Become the engineer companies fight for",
    hero_subheading:
      "Cohort-based coding programmes with code reviews, system design deep-dives, and real interview prep, taught by working engineers.",
    sample_course_title: "Full-Stack Engineering Bootcamp",
    sample_course_description:
      "An intensive cohort that takes you from solid fundamentals to shipping production-grade systems. You'll learn DSA the way it's actually asked in interviews, build full-stack projects with React + Node, and finish with a portfolio that earns interviews. Live classes twice a week, code reviews on every assignment, and a placement-prep month at the end.",
    sample_course_outcomes: [
      "Crack DSA rounds at top product companies",
      "Ship a full-stack capstone project to your portfolio",
      "Master system-design interview frameworks",
    ],
    faqs: [
      {
        question: "Will I get individual code reviews?",
        answer:
          "Yes, every assignment is reviewed by a senior engineer with line-level feedback. Cohort sizes are capped to keep this sustainable.",
      },
      {
        question: "Is this only for beginners?",
        answer:
          "No. We have separate tracks for absolute beginners and working engineers preparing for senior interviews. You'll be placed based on a short diagnostic.",
      },
      COMMON_FAQS_BASE[1],
    ],
    about_intro_paragraph:
      "{{orgName}} is a cohort-based coding school run by engineers, not marketers. We've shipped at startups and FAANGs, and we teach the way we wish we'd been taught, through real code, real reviews, and real shipping.",
    ai_hints_pillars: ["DSA", "System Design", "Interview Prep"],
    ai_hints_differentiators: [
      "Cohort code reviews",
      "Project-based learning",
      "Mentor 1:1s",
    ],
  },
  photography: {
    hero_headline: "See better. Shoot better.",
    hero_subheading:
      "Photography courses that teach you composition, light, and storytelling, not just camera buttons.",
    sample_course_title: "Photography Fundamentals",
    sample_course_description:
      "Whether you shoot on a phone or a full-frame, this course rewires how you see. You'll learn the rules of composition, master natural and artificial light, and finish with a 10-photo portfolio you'll be proud to share. Weekly assignments with detailed feedback, plus a private community of fellow learners.",
    sample_course_outcomes: [
      "Read light like a working photographer",
      "Compose photographs that hold attention",
      "Build a 10-image portfolio in the genre of your choice",
    ],
    faqs: COMMON_FAQS_BASE,
    about_intro_paragraph:
      "{{orgName}} teaches photography as a craft of seeing, not as gear acquisition. Our students range from phone photographers to working professionals, and they all leave with sharper instincts and a body of work to show.",
    ai_hints_pillars: ["Composition", "Light", "Storytelling"],
    ai_hints_differentiators: ["Portfolio-led", "Genre-specific tracks"],
  },
  mindfulness: {
    hero_headline: "Move better. Breathe better. Live better.",
    hero_subheading:
      "Daily-practice classes in yoga, meditation, and conscious movement, designed for real lives.",
    sample_course_title: "30-Day Foundation Practice",
    sample_course_description:
      "A four-week practice that builds the habit, not just the routine. Short daily sessions you can do at home, all you need is a mat. Each week introduces a new layer: breath, posture, mindfulness, integration. Suitable for complete beginners and anyone returning to practice after a break.",
    sample_course_outcomes: [
      "Build a sustainable daily practice in under 20 minutes",
      "Improve sleep, focus, and recovery measurably",
      "Move with awareness through your day, not just your mat",
    ],
    faqs: COMMON_FAQS_BASE,
    about_intro_paragraph:
      "{{orgName}} brings classical practice into modern life. We teach what works in 20 minutes a day, for people with jobs, kids, deadlines, and bad knees. The practice meets you where you are.",
    ai_hints_pillars: ["Movement", "Breath", "Mindfulness"],
    ai_hints_differentiators: ["Short daily sessions", "Beginner-friendly"],
  },
  examprep: {
    hero_headline: "JEE & NEET prep that actually works",
    hero_subheading:
      "Live classes, doubt sessions, full-length tests, and detailed analytics, taught by IIT/AIIMS alumni.",
    sample_course_title: "JEE Main Foundation Course",
    sample_course_description:
      "A complete preparation course covering Physics, Chemistry, and Mathematics for JEE Main. Live classes from top educators, weekly tests with NTA-pattern questions, doubt-clearing sessions, and a personalised analytics dashboard that flags exactly where you're losing marks. Designed for serious aspirants.",
    sample_course_outcomes: [
      "Cover the full JEE Main syllabus with structured pacing",
      "Identify and fix your weakest topics with analytics",
      "Build test temperament across 25+ full-length mocks",
    ],
    faqs: [
      {
        question: "How are the live classes scheduled?",
        answer:
          "Classes run six days a week in two slots, morning and evening, so you can attend either. Recordings are available for life if you miss a session.",
      },
      {
        question: "Are mock tests at the actual JEE difficulty?",
        answer:
          "Yes, our papers are calibrated to recent JEE Main and Advanced patterns. We publish detailed solutions and rank-predictor analytics within 24 hours.",
      },
      COMMON_FAQS_BASE[2],
    ],
    about_intro_paragraph:
      "{{orgName}} is built by IIT and AIIMS alumni who've cracked these exams themselves. We teach the way that actually moves the rank, concept clarity first, then drill, then test temperament.",
    ai_hints_pillars: ["Concepts", "Practice", "Test Temperament"],
    ai_hints_differentiators: ["IIT/AIIMS faculty", "Rank-predictor analytics"],
  },
  govtexam: {
    hero_headline: "Crack the government exam you've been preparing for",
    hero_subheading:
      "UPSC, SSC, banking, and railway prep, structured courses, daily current affairs, and full-length mocks.",
    sample_course_title: "UPSC Civil Services Foundation",
    sample_course_description:
      "A comprehensive foundation programme for UPSC Prelims and Mains. NCERT walkthroughs, structured GS coverage, daily current affairs digest, weekly answer-writing practice with evaluation, and 30+ full-length mocks. Designed for first-time aspirants who want a clear, confidence-building runway.",
    sample_course_outcomes: [
      "Build a strong NCERT-rooted foundation across GS papers",
      "Develop daily-news-to-answer-writing habit",
      "Track your prep with topic-wise progress dashboards",
    ],
    faqs: COMMON_FAQS_BASE,
    about_intro_paragraph:
      "{{orgName}} is a focused prep platform for India's most demanding government exams. We've trained thousands of aspirants and we keep our courses lean, no fluff, just the topics, drills, and tests that move the needle.",
    ai_hints_pillars: ["Foundation", "Current Affairs", "Answer Writing"],
    ai_hints_differentiators: ["Daily current affairs", "Mentor evaluation"],
  },
  astrology: {
    hero_headline: "Read the chart. Read the moment.",
    hero_subheading:
      "Vedic astrology courses, live readings, and a community of serious students of the cosmos.",
    sample_course_title: "Vedic Astrology Foundations",
    sample_course_description:
      "An introduction to the language of Vedic astrology. You'll learn to read a birth chart, understand planetary periods, and start interpreting how the sky maps to a life. Includes live Q&A sessions, supervised practice readings, and a private community for ongoing learning.",
    sample_course_outcomes: [
      "Read a Vedic birth chart with confidence",
      "Understand the meaning of planetary periods (dashas)",
      "Practise interpretation in a supportive cohort",
    ],
    faqs: COMMON_FAQS_BASE,
    about_intro_paragraph:
      "{{orgName}} teaches Vedic astrology as it was meant to be taught, slowly, contextually, in conversation with classical texts. Whether you're curious or committed, we have a track that fits.",
    ai_hints_pillars: ["Chart Reading", "Dashas", "Interpretation"],
    ai_hints_differentiators: ["Classical text grounding", "Live readings"],
  },
  corpupskill: {
    hero_headline: "Upskill your team with programmes that ship outcomes",
    hero_subheading:
      "Cohort-based corporate training in leadership, sales, product, and engineering, built for measurable impact.",
    sample_course_title: "Manager Onboarding Programme",
    sample_course_description:
      "A six-week programme for newly promoted managers and senior ICs stepping into leadership. Frameworks for one-on-ones, performance conversations, hiring, and managing up. Live workshops, case-based discussions, peer cohorts, and an executive coach for every learner. Built around what your managers actually face on Monday morning.",
    sample_course_outcomes: [
      "Run effective one-on-ones and performance conversations",
      "Build a hiring funnel and screen for fit confidently",
      "Develop a network of peer managers across cohorts",
    ],
    faqs: COMMON_FAQS_BASE,
    about_intro_paragraph:
      "{{orgName}} partners with growing companies to upskill teams in the capabilities that matter, leadership, sales, product, engineering. Our cohorts are taught by practitioners and measured against outcomes, not attendance.",
    ai_hints_pillars: ["Leadership", "Performance", "Strategy"],
    ai_hints_differentiators: ["Cohort-based", "Executive coaching"],
  },
};

export function getFallbackContent(
  templateId: TemplateId,
  themeId: ThemeId,
  orgName: string,
): GeneratedAcademyBundle {
  const f = TEMPLATE_FALLBACKS[templateId];
  const interpolate = (s: string) => s.replaceAll("{{orgName}}", orgName);
  return {
    template_id: templateId,
    theme_id: themeId,
    ai_hints: {
      audience_persona: "Learners aligned with the teaching focus of this academy",
      tone: "professional",
      growth_stage: "growing",
      differentiators: f.ai_hints_differentiators,
      content_pillars: f.ai_hints_pillars,
    },
    hero_headline: f.hero_headline,
    hero_subheading: f.hero_subheading,
    sample_course_title: interpolate(f.sample_course_title),
    sample_course_description: interpolate(f.sample_course_description),
    sample_course_outcomes: f.sample_course_outcomes,
    faqs: f.faqs,
    about_intro_paragraph: interpolate(f.about_intro_paragraph),
  };
}
