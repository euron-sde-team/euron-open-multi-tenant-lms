import { generateText, Output } from "ai";
import sharp from "sharp";
import { z } from "zod";
import { BadRequestError } from "../errors/bad-request.error";
import {
  findCurriculumOutline,
  type CurriculumOutlineRow,
} from "../repositories/course-lms.repository";
import logger from "../utils/logger";
import { generateImage as generateAiImage, getTextModel, recordUsage } from "../lib/ai/provider";


export type CourseAISectionKey =
  | "subtitle"
  | "learningOutcomes"
  | "curriculum"
  | "offerings"
  | "requirements"
  | "description"
  | "faqs"
  | "thumbnails";

const ALL_SECTION_KEYS: CourseAISectionKey[] = [
  "subtitle",
  "learningOutcomes",
  "curriculum",
  "offerings",
  "requirements",
  "description",
  "faqs",
  "thumbnails",
];

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const subtitleSchema = z.object({
  subTitle: z
    .string()
    .describe(
      "A compelling subtitle that describes what students will learn and achieve in this course (1-2 sentences, max 200 characters)"
    ),
});

const learningOutcomesSchema = z.object({
  learningOutcomes: z
    .array(z.string())
    .describe(
      "List of 4-8 specific, actionable learning outcomes. Each should start with an action verb (Master, Build, Apply, Gain, etc.)"
    ),
});

const curriculumSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z.string().describe("Section title"),
        order: z.number().describe("Section order (0-indexed)"),
        modules: z
          .array(
            z.object({
              title: z.string().describe("Module title"),
              order: z.number().describe("Module order within section (0-indexed)"),
              lectures: z
                .array(
                  z.object({
                    title: z.string().describe("Lecture title"),
                    order: z.number().describe("Lecture order within module (0-indexed)"),
                    duration: z
                      .string()
                      .describe("Estimated duration (e.g. '15 min', '30 min', '1 hr')"),
                  })
                )
                .describe("1-10 lectures within this module"),
            })
          )
          .describe("1-6 modules within this section"),
      })
    )
    .describe(
      "3-12 course sections, each with modules and lectures"
    ),
});

const offeringsSchema = z.object({
  offerings: z
    .array(
      z.object({
        icon: z
          .enum([
            "video",
            "download",
            "certificate",
            "lifetime",
            "mobile",
            "assignment",
            "quiz",
            "support",
            "project",
            "code",
          ])
          .describe("Icon type for the offering"),
        text: z.string().describe("Description of what is included"),
      })
    )
    .describe("4-6 course offerings/inclusions"),
});

const requirementsSchema = z.object({
  prerequisites: z
    .array(z.string())
    .describe("2-5 prerequisites or requirements for taking this course"),
});

const descriptionSchema = z.object({
  description: z
    .string()
    .describe(
      "A comprehensive course description in plain text (2-4 paragraphs). No HTML or markdown. Use line breaks between paragraphs. Describe who the course is for, what they will learn, and why it matters."
    ),
});

const faqsSchema = z.object({
  faqs: z
    .array(
      z.object({
        question: z.string().describe("Frequently asked question"),
        answer: z.string().describe("Clear, helpful answer to the question"),
      })
    )
    .describe("4-8 frequently asked questions with helpful answers"),
});

const allSectionsSchema = z.object({
  subTitle: subtitleSchema.shape.subTitle,
  learningOutcomes: learningOutcomesSchema.shape.learningOutcomes,
  sections: curriculumSchema.shape.sections,
  offerings: offeringsSchema.shape.offerings,
  prerequisites: requirementsSchema.shape.prerequisites,
  description: descriptionSchema.shape.description,
  faqs: faqsSchema.shape.faqs,
});

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Flavour controls the tone, depth, visual style, and audience calibration
 * of all generated content. When not provided, the system auto-infers the
 * best flavour from the course title and any supplied context.
 */
export type CourseFlavour =
  | "professional" // Corporate training, certifications, enterprise upskilling
  | "academic" // University-style, research-oriented, theory-heavy
  | "creative" // Design, arts, writing, media production, music, film
  | "technical" // Coding, engineering, DevOps, system design
  | "beginner" // Absolute beginners, non-technical audience, gentle onboarding
  | "bootcamp" // Intensive, fast-paced, career-switching, project-driven
  | "executive" // C-suite, leadership, strategy, high-level decision-making
  | "kids" // Children & young learners, gamified, visual-first
  | "healthcare" // Medical, clinical, compliance-heavy, evidence-based
  | "data" // Data science, analytics, ML/AI, statistics
  | "lifestyle" // Fitness, wellness, cooking, personal development, self-care
  | "career" // Interview prep, resume building, career coaching, soft skills
  | "language" // Language learning, IELTS/TOEFL prep, conversation practice
  | string; // Custom flavour: AI will interpret and adapt

export interface ThumbnailContext {
  mentorName?: string;
  courseMode?: string;
  startDate?: string;
  organizationName?: string;
  instructorNames?: string[];
  batchLanguage?: string;
}

export interface GenerateCourseContentParams {
  courseTitle: string;
  sections: CourseAISectionKey[];
  extraContext?: string;
  thumbnailContext?: ThumbnailContext;
  /** Style/tone flavour. If omitted, auto-inferred from title + context. */
  flavour?: CourseFlavour;
  /** Optional: a document (text/markdown/plain) for AI to understand and use as reference. */
  referenceDocument?: string;
  /** Optional: base64 data URL of a reference image (e.g., existing branding, syllabus screenshot). */
  referenceImageDataUrl?: string;
  /** Optional: description of what the reference image contains (helps AI interpret). */
  referenceImageDescription?: string;
  /** Target audience override (e.g., "senior backend engineers", "MBA students"). */
  targetAudience?: string;
  /** Desired course duration hint (e.g., "4 weeks", "3 months", "weekend crash course"). */
  courseDuration?: string;
  /** Difficulty level override. */
  difficultyLevel?: "beginner" | "intermediate" | "advanced" | "mixed";
  /** Industry/domain hint (e.g., "fintech", "healthcare", "e-commerce"). */
  industry?: string;
  /** Existing course metadata from the editor, used to enrich thumbnail prompts. */
  courseMetadata?: {
    subTitle?: string;
    description?: string;
    difficulty?: string;
    duration?: string;
    categoryNames?: string[];
    learningOutcomes?: string[];
  };
  /**
   * Formatted outline of the course's ACTUAL uploaded LMS content
   * (sections/lessons/lectures). When present, syllabus, offerings, and FAQs
   * are grounded in it instead of being invented. Built via
   * `buildLmsContentContext()`.
   */
  lmsContent?: string;
}

export interface GeneratedCourseContent {
  subTitle?: string;
  learningOutcomes?: string[];
  sections?: Array<{
    title: string;
    order: number;
    modules: Array<{
      title: string;
      order: number;
      lectures: Array<{
        title: string;
        order: number;
        duration: string;
      }>;
    }>;
  }>;
  offerings?: Array<{
    icon: string;
    text: string;
  }>;
  prerequisites?: string[];
  description?: string;
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
  webThumbnailDataUrl?: string;
  mobileThumbnailDataUrl?: string;
}

// ─── Flavour Auto-Inference ──────────────────────────────────────────────────

const FLAVOUR_KEYWORDS: Record<CourseFlavour, string[]> = {
  technical: [
    "python", "javascript", "react", "node", "api", "devops", "docker", "kubernetes",
    "aws", "azure", "gcp", "cloud", "microservices", "backend", "frontend", "fullstack",
    "full-stack", "typescript", "rust", "golang", "java", "c++", "programming", "coding",
    "software", "software engineering", "git", "ci/cd", "terraform", "linux", "database", "sql",
    "nosql", "redis", "kafka", "system design", "dsa", "algorithms", "data structures",
    "web development", "app development",
  ],
  data: [
    "data science", "machine learning", "deep learning", "ai", "artificial intelligence",
    "nlp", "natural language", "computer vision", "tensorflow", "pytorch", "pandas",
    "numpy", "statistics", "analytics", "big data", "spark", "hadoop", "etl", "mlops",
    "llm", "generative ai", "neural network", "regression", "classification", "rag",
  ],
  creative: [
    "graphic design", "web design", "game design", "sound design", "ux design", "ui design",
    "ui/ux", "figma", "photoshop", "illustrator", "animation",
    "video editing", "video production",
    "photography", "creative writing", "storytelling", "branding", "logo",
    "graphic", "motion graphics", "3d", "blender", "after effects", "premiere",
    "content creation", "copywriting", "ux research", "user experience",
    "music", "guitar", "piano", "singing", "vocals", "film", "filmmaking",
    "screenwriting", "acting", "dance", "watercolor", "oil painting",
    "sculpture", "pottery", "crafts", "knitting", "calligraphy",
  ],
  professional: [
    "management", "leadership", "project management", "pmp", "agile", "scrum",
    "business", "marketing", "sales", "negotiation", "business communication", "presentation",
    "excel", "powerpoint", "productivity", "hr", "human resources", "compliance",
    "governance", "risk management", "audit", "finance", "accounting",
    "consulting", "strategy consulting", "supply chain", "operations",
    "real estate", "investing", "stock market", "trading", "financial planning",
    "entrepreneurship",
  ],
  academic: [
    "research", "thesis", "dissertation", "methodology", "literature review", "theory",
    "philosophy", "history", "physics", "chemistry", "biology", "mathematics", "calculus",
    "algebra", "quantum", "organic chemistry", "molecular", "genetics",
    "sociology", "psychology", "economics", "political science", "anthropology",
    "literature", "linguistics", "archaeology", "astronomy", "environmental science",
    "education", "pedagogy",
  ],
  beginner: [
    "introduction to", "basics of", "getting started", "101",
    "for beginners", "zero to", "from scratch", "no experience",
    "beginner's guide", "step by step",
  ],
  bootcamp: [
    "bootcamp", "crash course", "intensive", "career switch", "job ready",
    "placement", "interview prep", "portfolio", "capstone", "full time",
  ],
  executive: [
    "executive", "c-suite", "ceo", "cto", "cfo", "business strategy", "corporate strategy",
    "board", "transformation", "digital transformation", "innovation", "disruption",
    "venture", "startup founder",
  ],
  kids: [
    "kids", "children", "young learners", "scratch programming", "minecraft", "roblox",
    "fun with", "junior", "teen", "age 8", "age 10", "age 12",
    "homework", "math for kids", "science for kids", "spelling",
    "phonics", "crafts for kids", "coding for kids",
  ],
  healthcare: [
    "medical", "clinical", "nursing", "pharmacy", "healthcare", "patient",
    "diagnosis", "treatment", "anatomy", "physiology",
    "hospital", "telehealth", "hipaa", "ehr", "emr", "medical coding",
    "clinical nutrition", "dietetics", "physiotherapy", "mental health",
    "first aid", "cpr", "dental", "veterinary", "occupational therapy",
  ],
  lifestyle: [
    "fitness", "yoga", "meditation", "wellness", "diet", "cooking", "nutrition",
    "recipe", "baking", "culinary", "workout", "exercise", "weight loss",
    "self-care", "mindfulness", "personal development", "self-help",
    "productivity habits", "time management", "life coaching", "motivation",
    "gardening", "home decor", "interior design", "fashion", "beauty",
    "skincare", "makeup", "parenting", "relationships",
  ],
  career: [
    "job interview", "resume", "cv", "job search", "career", "salary negotiation",
    "career change", "career growth", "professional development", "soft skills",
    "communication skills", "public speaking", "professional networking", "personal branding",
    "linkedin", "cover letter", "job placement", "corporate culture",
    "freelancing", "freelancer", "side hustle", "entrepreneurship basics",
  ],
  language: [
    "english language", "learn english", "spoken english", "business english",
    "spanish", "french", "german", "japanese", "chinese", "mandarin",
    "korean", "hindi", "arabic", "portuguese", "italian", "russian", "turkish",
    "language learning", "pronunciation",
    "ielts", "toefl", "toeic", "delf", "jlpt", "hsk", "fluency", "bilingual",
  ],
};

// Escape special regex characters in keyword strings (for c++, ci/cd, ui/ux, etc.)
function escapeRegex(str: string): string {
  return str.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function inferFlavour(
  courseTitle: string,
  extraContext?: string,
  targetAudience?: string,
  industry?: string
): CourseFlavour {
  const combined = [courseTitle, extraContext, targetAudience, industry]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const scores: Record<string, number> = {};

  for (const [flavour, keywords] of Object.entries(FLAVOUR_KEYWORDS)) {
    scores[flavour] = 0;
    for (const kw of keywords) {
      // Word-boundary matching: keyword must not be part of a larger word.
      // Uses \W (non-word-char) or string boundary to prevent substring false
      // positives (e.g., "ai" inside "training", "go" inside "going").
      const pattern = new RegExp(`(?<![\\w])${escapeRegex(kw)}(?![\\w])`);
      if (pattern.test(combined)) {
        // Longer keyword matches are worth more (more specific)
        scores[flavour] += kw.split(" ").length;
      }
    }
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (best[0][1] > 0) return best[0][0] as CourseFlavour;

  // Default fallback: professional
  return "professional";
}

// ─── Flavour → Prompt Enrichment ─────────────────────────────────────────────

function getFlavourDirectives(flavour: CourseFlavour): string {
  const directives: Record<string, string> = {
    technical: `
FLAVOUR: Technical / Engineering
- Use precise technical terminology; avoid vague hand-waving.
- Include real-world code patterns, architecture decisions, and tool-specific workflows.
- Lectures should reference actual libraries, frameworks, and version numbers where relevant.
- Curriculum should progress: fundamentals → core concepts → advanced patterns → production-grade projects.
- Learning outcomes must be demonstrable (e.g., "Deploy a containerized microservice to AWS ECS").
- FAQs should address environment setup, common debugging scenarios, and career applicability.
- Description should mention tech stack specifics and the type of projects students will build.
- Tone: Direct, concise, engineer-to-engineer. No fluff.`,

    data: `
FLAVOUR: Data Science / AI / ML
- Balance mathematical rigor with practical implementation.
- Include dataset references, model evaluation metrics, and experiment workflows.
- Curriculum should cover: data wrangling → EDA → modeling → evaluation → deployment/MLOps.
- Lectures should mention specific tools (Jupyter, pandas, scikit-learn, PyTorch, etc.).
- Learning outcomes should include both understanding (theory) and doing (implementation).
- FAQs should address compute requirements, dataset access, and portfolio building.
- Tone: Analytical yet accessible. Show the "why" behind every technique.`,

    creative: `
FLAVOUR: Creative / Design / Arts
- Use inspiring, visually-rich language that sparks imagination.
- Curriculum should alternate between technique lessons and creative exercises/projects.
- Include critique sessions, portfolio reviews, and style exploration modules.
- Learning outcomes should blend skill mastery with creative confidence.
- Offerings should emphasize downloadable assets, templates, and community feedback.
- FAQs should address creative blocks, portfolio building, and industry standards.
- Tone: Encouraging, expressive, and visual. Paint a picture with words.`,

    professional: `
FLAVOUR: Professional / Corporate / Business
- Use polished, business-appropriate language with clear ROI framing.
- Curriculum should map to professional competencies and real workplace scenarios.
- Include case studies, frameworks, templates, and actionable takeaways per module.
- Learning outcomes should tie to career advancement and measurable business impact.
- FAQs should address certification value, time commitment for working professionals, and team licensing.
- Tone: Confident, structured, results-oriented. Respect the learner's time.`,

    academic: `
FLAVOUR: Academic / Research / Scholarly
- Use rigorous academic language with proper conceptual scaffolding.
- Curriculum should build from foundational theory → core principles → advanced topics → research frontiers.
- Include reading lists, discussion prompts, and analytical exercises.
- Learning outcomes should emphasize critical thinking, analysis, and synthesis.
- FAQs should address academic credit, research applications, and further study paths.
- Tone: Scholarly yet engaging. Intellectual depth without being impenetrable.`,

    beginner: `
FLAVOUR: Beginner-Friendly / Onboarding
- Use simple, jargon-free language. Define every technical term on first use.
- Curriculum should start with the absolute basics, assume zero prior knowledge.
- Include lots of guided exercises, check-your-understanding quizzes, and "follow along" lectures.
- Learning outcomes should feel achievable and confidence-building.
- Pacing should be gentle: shorter lectures (10-15 min), frequent recaps.
- FAQs should address "Am I ready for this?" and "What if I get stuck?" concerns.
- Tone: Warm, patient, encouraging. Like a supportive mentor.`,

    bootcamp: `
FLAVOUR: Bootcamp / Intensive / Career-Track
- Use high-energy, action-oriented language. Emphasize speed and outcomes.
- Curriculum should be dense, project-driven, with weekly milestones and a capstone.
- Include mock interviews, portfolio projects, and industry-aligned assessments.
- Learning outcomes should map directly to job descriptions and hiring criteria.
- Prerequisites should be clear and specific, this is not a gentle introduction.
- FAQs should address time commitment, job placement, and what "job-ready" means.
- Tone: Motivating, no-nonsense, career-focused. "You will be job-ready."`,

    executive: `
FLAVOUR: Executive / Leadership / Strategic
- Use high-level strategic language. Focus on frameworks, not implementation details.
- Curriculum should cover: landscape analysis → strategic frameworks → decision-making → execution.
- Include case studies from Fortune 500 companies, industry reports, and strategic exercises.
- Learning outcomes should focus on decision quality, strategic thinking, and organizational impact.
- Keep lectures concise (15-20 min max), executives have limited time.
- FAQs should address ROI, peer cohort quality, and networking opportunities.
- Tone: Authoritative, concise, strategic. Respect the seniority of the audience.`,

    kids: `
FLAVOUR: Kids / Young Learners
- Use fun, energetic, age-appropriate language. Include analogies kids relate to (games, stories, nature).
- Curriculum should be gamified with challenges, badges, and creative projects.
- Lectures should be short (5-10 min), highly visual, and interactive.
- Learning outcomes should feel like superpowers ("You'll be able to create your own game!").
- Prerequisites should reassure parents, no prior experience needed.
- FAQs should address parental concerns: screen time, safety, age-appropriateness.
- Tone: Playful, encouraging, wonder-filled. Make learning feel like play.`,

    healthcare: `
FLAVOUR: Healthcare / Medical / Clinical
- Use evidence-based, clinically accurate language with proper medical terminology.
- Curriculum should align with clinical guidelines, compliance standards, and best practices.
- Include case-based learning, clinical scenarios, and documentation exercises.
- Learning outcomes should map to clinical competencies and certification requirements.
- Prerequisites should specify required medical background or credentials.
- FAQs should address CME/CE credits, compliance, and clinical applicability.
- Tone: Professional, precise, patient-safety-conscious. Authority with empathy.`,

    lifestyle: `
FLAVOUR: Lifestyle / Wellness / Personal Growth
- Use warm, motivating, and relatable language that inspires positive change.
- Curriculum should balance knowledge with actionable daily practices and habits.
- Include self-assessment exercises, habit trackers, and personal reflection modules.
- Learning outcomes should connect to tangible life improvements and well-being metrics.
- FAQs should address time commitment, equipment/materials needed, and realistic expectations.
- Description should emphasize transformation and practical applicability to daily life.
- Tone: Encouraging, authentic, and empowering. Like a supportive coach.`,

    career: `
FLAVOUR: Career Development / Interview Prep / Professional Growth
- Use confident, empowering language focused on career advancement and professional success.
- Curriculum should include practical exercises, role-plays, templates, and real-world scenarios.
- Include mock exercises, self-assessment tools, and portfolio/profile building modules.
- Learning outcomes should map to concrete career milestones (interviews, promotions, transitions).
- FAQs should address timeline to results, industry applicability, and what to prepare.
- Description should connect the content to real career outcomes and professional growth.
- Tone: Encouraging yet professional. Practical and results-oriented.`,

    language: `
FLAVOUR: Language Learning
- Use encouraging, immersive language that builds confidence in the target language.
- Curriculum should follow natural language acquisition: listening → speaking → reading → writing.
- Include conversation practice, cultural context modules, and real-world usage scenarios.
- Learning outcomes should map to proficiency levels (A1-C2 / beginner-advanced).
- Lectures should include audio/visual immersion elements and practical dialogues.
- FAQs should address practice time requirements, immersion tips, and proficiency goals.
- Description should emphasize communicative competence and cultural understanding.
- Tone: Patient, encouraging, and culturally aware. Celebrate progress at every level.`,
  };

  return (
    directives[flavour] ||
    `
FLAVOUR: "${flavour}" (Custom)
- Adapt tone, depth, and style to match the "${flavour}" theme as you best interpret it.
- If "${flavour}" suggests a specific industry, audience, or teaching style, lean into that fully.
- Maintain professionalism while embodying the unique character this flavour implies.
- When in doubt, prioritize clarity, engagement, and practical value.`
  );
}

// ─── Service ─────────────────────────────────────────────────────────────────

class CourseAIService {
  private async optimizeThumbnail(base64Data: string): Promise<string> {
    const inputBuffer = Buffer.from(base64Data, "base64");
    const optimized = await sharp(inputBuffer)
      .rotate()
      .webp({ quality: 85 })
      .toBuffer();
    return `data:image/webp;base64,${optimized.toString("base64")}`;
  }

  private getModel() {
    return getTextModel("course");
  }

  /**
   * Builds a context block from existing course metadata to help the image
   * generator understand the course topic, audience, and difficulty, so it
   * can pick relevant visual elements (icons, illustrations, colour emphasis).
   */
  private buildCourseMetadataBlock(
    meta?: GenerateCourseContentParams["courseMetadata"]
  ): string {
    if (!meta) return "";

    const lines: string[] = [];
    // NOTE: subtitle and description are intentionally excluded, the image
    // model tends to render them as visible text in the thumbnail, causing
    // duplicated / unwanted text alongside the title.
    if (meta.difficulty && meta.difficulty !== "NONE") {
      lines.push(`- Difficulty Level: ${meta.difficulty} (reflect this in the visual complexity and tone)`);
    }
    if (meta.duration) lines.push(`- Duration: ${meta.duration}`);
    if (meta.categoryNames?.length) {
      lines.push(`- Categories: ${meta.categoryNames.join(", ")} (use domain-relevant icons and visual elements)`);
    }
    if (meta.learningOutcomes?.length) {
      const topOutcomes = meta.learningOutcomes.slice(0, 3).join("; ");
      lines.push(`- Key Outcomes: ${topOutcomes} (reflect these skills/topics in the visual elements)`);
    }

    if (lines.length === 0) return "";

    return `
Course Content Context (use ONLY to choose relevant visual elements, icons, and imagery, do NOT render any of the following as text in the image):
${lines.join("\n")}
`;
  }

  /**
   * Fetches the course's uploaded LMS curriculum and formats it as a prompt
   * context block. Returns undefined when the course has no content yet, so
   * generation falls back to title-based inference.
   */
  async buildLmsContentContext(
    tenantId: string,
    lmsCourseId: string
  ): Promise<string | undefined> {
    const rows = await findCurriculumOutline(tenantId, lmsCourseId);
    if (rows.length === 0) return undefined;

    const bySection = new Map<string, CurriculumOutlineRow[]>();
    for (const row of rows) {
      const list = bySection.get(row.section_title) ?? [];
      list.push(row);
      bySection.set(row.section_title, list);
    }

    let lessonCount = 0;
    let videoCount = 0;
    let quizCount = 0;
    let assignmentCount = 0;

    const lines: string[] = [];
    let sectionIndex = 0;
    for (const [sectionTitle, sectionRows] of bySection) {
      sectionIndex += 1;
      lines.push(`Section ${sectionIndex}: ${sectionTitle}`);
      const seenLessons = new Set<string>();
      for (const row of sectionRows) {
        if (!row.lesson_title || seenLessons.has(row.lesson_title)) continue;
        seenLessons.add(row.lesson_title);
        lessonCount += 1;
        if (row.lesson_type === "QUIZ") {
          quizCount += 1;
          lines.push(`  - ${row.lesson_title} [Quiz]`);
        } else if (row.lesson_type === "ASSIGNMENT") {
          assignmentCount += 1;
          lines.push(`  - ${row.lesson_title} [Assignment]`);
        } else {
          videoCount += 1;
          const duration = row.lecture_duration ? `, ${row.lecture_duration}` : "";
          lines.push(`  - ${row.lesson_title} [Video${duration}]`);
        }
      }
    }

    lines.push("");
    lines.push(
      `Totals: ${bySection.size} sections, ${lessonCount} lessons (${videoCount} video lectures, ${quizCount} quizzes, ${assignmentCount} assignments).`
    );

    return lines.join("\n");
  }

  /**
   * Builds the master prompt that is flavour-aware, document-aware,
   * image-aware, and audience-calibrated. Even with just a course title,
   * it produces rich, contextually intelligent output.
   */
  private buildPrompt(params: {
    courseTitle: string;
    extraContext?: string;
    flavour: CourseFlavour;
    referenceDocument?: string;
    referenceImageDescription?: string;
    targetAudience?: string;
    courseDuration?: string;
    difficultyLevel?: string;
    industry?: string;
    lmsContent?: string;
  }): string {
    const {
      courseTitle,
      extraContext,
      flavour,
      referenceDocument,
      referenceImageDescription,
      targetAudience,
      courseDuration,
      difficultyLevel,
      industry,
      lmsContent,
    } = params;

    let prompt = `You are a world-class course curriculum designer, instructional architect, and educational content strategist. You have deep expertise across every domain, technology, business, healthcare, creative arts, fitness, cooking, music, career development, language learning, personal growth, finance, law, sports, trades, spirituality, and beyond. You create content that is not just informative but transformative, courses that people remember, recommend, and complete.

CRITICAL: DOMAIN FIDELITY:
- Carefully analyze the course title to determine its actual domain. It could be ANY field, do not assume technology or programming.
- Generate content that is 100% faithful to the course's actual domain. A cooking course must produce cooking content, a fitness course must produce fitness content, a career coaching course must produce career content, etc.
- NEVER default to technology, programming, or data science content unless the title explicitly indicates a tech topic.
- If a reference document or extra context is provided, treat that as the PRIMARY signal for domain and content, it overrides any assumptions.

═══════════════════════════════════════════════════════
COURSE TITLE: "${courseTitle}"
═══════════════════════════════════════════════════════
`;

    // ── Flavour Directives ──
    prompt += `
${getFlavourDirectives(flavour)}
`;

    // ── Actual Uploaded LMS Content ──
    if (lmsContent) {
      prompt += `
───────────────────────────────────────────────────────
ACTUAL UPLOADED COURSE CONTENT (from the LMS, the REAL curriculum):
───────────────────────────────────────────────────────
The course already has real content uploaded. The outline below is the
DEFINITIVE source of truth for what this course covers, it overrides the
title, any assumptions, and (for structure) even the reference document.
You MUST:
1. Treat these section and lesson titles as the actual topics taught, never invent topics that are not represented here.
2. Base the curriculum/syllabus on this exact structure (same sections, same order).
3. Derive counts (video hours, number of quizzes, assignments, lessons) from the totals below, never fabricate numbers.
4. Use the terminology and topic names that appear in these titles throughout all generated sections.

UPLOADED CONTENT OUTLINE:
"""
${lmsContent}
"""
`;
    }

    // ── Reference Document ──
    if (referenceDocument) {
      prompt += `
───────────────────────────────────────────────────────
REFERENCE DOCUMENT (provided by admin, use as source of truth):
───────────────────────────────────────────────────────
The following document has been provided as reference material. You MUST:
1. Extract key topics, concepts, terminology, and structure from this document.
2. Align the curriculum, learning outcomes, and description with the document's content.
3. Use domain-specific vocabulary found in the document.
4. If the document contains a syllabus or outline, use it as the backbone for curriculum generation.
5. If the document contains learning objectives, incorporate and enhance them.
6. Preserve any specific tools, technologies, or methodologies mentioned.

DOCUMENT CONTENT:
"""
${referenceDocument}
"""
`;
    }

    // ── Reference Image ──
    if (referenceImageDescription) {
      prompt += `
───────────────────────────────────────────────────────
REFERENCE IMAGE ANALYSIS:
───────────────────────────────────────────────────────
An image has been provided with the following description: "${referenceImageDescription}"
- If this appears to be a syllabus/outline screenshot, extract and follow its structure.
- If this is branding material, match the visual tone and terminology in descriptions.
- If this is a diagram or infographic, incorporate its concepts into the curriculum.
- Use any visible text, topics, or themes as additional context for content generation.
`;
    }

    // ── Audience & Context Enrichment ──
    prompt += `
───────────────────────────────────────────────────────
COURSE CONTEXT & AUDIENCE
───────────────────────────────────────────────────────`;

    if (targetAudience) {
      prompt += `
Target Audience: ${targetAudience}
- Calibrate all language complexity, examples, and prerequisites to this audience.
- Tailor learning outcomes to what THIS audience specifically needs for career/skill advancement.`;
    } else {
      prompt += `
Target Audience: Not specified, intelligently infer from the course title and context.
- If the title suggests advanced content, target intermediate-to-advanced learners.
- If the title suggests introductory content, target beginners.
- Default to a practical, working-professional audience if truly ambiguous.`;
    }

    if (courseDuration) {
      prompt += `
Course Duration: ${courseDuration}
- Scale curriculum depth and lecture count to fit this timeframe realistically.
- A "weekend crash course" needs fewer, more focused sections than a "3-month program".`;
    }

    if (difficultyLevel) {
      prompt += `
Difficulty Level: ${difficultyLevel}
- ${difficultyLevel === "beginner" ? "Start from absolute basics. No assumed prior knowledge." : ""}
- ${difficultyLevel === "intermediate" ? "Assume foundational knowledge. Focus on deepening skills and real-world application." : ""}
- ${difficultyLevel === "advanced" ? "Assume strong foundation. Focus on edge cases, optimization, architecture, and mastery." : ""}
- ${difficultyLevel === "mixed" ? "Design a journey from fundamentals to advanced. Clearly label difficulty progression." : ""}`;
    }

    if (industry) {
      prompt += `
Industry Context: ${industry}
- Use industry-specific examples, case studies, and terminology.
- Align projects and exercises with real ${industry} workflows and challenges.
- Reference relevant ${industry} tools, platforms, and standards.`;
    }

    if (extraContext) {
      prompt += `

Additional Admin Instructions:
${extraContext}
- Follow these instructions as specific overrides where they conflict with defaults.`;
    }

    // ── Universal Quality Standards ──
    prompt += `

───────────────────────────────────────────────────────
UNIVERSAL QUALITY STANDARDS (apply to ALL generated content):
───────────────────────────────────────────────────────
1. DEPTH OVER BREADTH: Fewer topics covered deeply beats many topics covered superficially.
2. PRACTICAL FIRST: Every concept should connect to a real-world application or project.
3. PROGRESSIVE COMPLEXITY: Content flows naturally from simple → complex, concrete → abstract.
4. ENGAGEMENT: Use compelling language that motivates. Avoid dry, textbook-style prose.
5. SPECIFICITY: Mention actual tools, resources, methodologies, and domain-specific references relevant to the course's field, not vague references.
6. COMPLETENESS: Even from a minimal title, generate rich, comprehensive content.
   - Infer the most likely tools, resources, and methodologies from the course title and its domain.
   - Fill in realistic details that an expert instructor would include.
   - When in doubt, be MORE detailed rather than less.
7. CONSISTENCY: All sections should feel like they belong to the same course by the same instructor.
8. MODERN & CURRENT: Reference current best practices, latest versions, and 2024-2025 industry trends.
`;

    return prompt;
  }

  /**
   * Returns the rich, per-section instruction prompts used by both single-section
   * and all-sections generation paths. Extracted to ensure identical quality and
   * domain fidelity regardless of generation mode.
   */
  private getSectionInstructions(
    courseTitle: string,
    params: {
      flavour: CourseFlavour;
      referenceDocument?: string;
      targetAudience?: string;
      courseDuration?: string;
      difficultyLevel?: string;
      industry?: string;
      lmsContent?: string;
    }
  ): Record<CourseAISectionKey, string> {
    return {
      subtitle: `
═══ TASK: Generate Course Subtitle ═══
Create a subtitle that is:
- A magnetic 1-2 sentence hook that communicates transformation, not just content.
- Pattern: "[What you'll achieve] by [method/approach], [outcome/career impact]"
- It should make someone stop scrolling and click "Enroll".
- Match the ${params.flavour} tone precisely.
- If a reference document exists, distill its core promise into the subtitle.

Examples of great subtitles (across different domains):
- "Build Production-Ready APIs with Node.js, Express & MongoDB: From Zero to Deployment"
- "Transform Your Body and Mind with Science-Backed Fitness Strategies: From Beginner to Advanced"
- "Ace Every Interview with Proven Communication Frameworks: Land Your Dream Role with Confidence"
- "Master Watercolor Painting Through Guided Projects: From First Brushstroke to Gallery-Ready Art"

Now generate ONE compelling subtitle for: "${courseTitle}"`,

      learningOutcomes: `
═══ TASK: Generate Learning Outcomes ═══
Create 4-8 learning outcomes that are:
- SPECIFIC: Not "Understand databases" but "Design normalized database schemas using PostgreSQL with proper indexing strategies"; not "Learn about nutrition" but "Create personalized macro-balanced meal plans using evidence-based nutritional frameworks"
- ACTION-ORIENTED: Start with strong verbs: Build, Deploy, Architect, Analyze, Create, Implement, Design, Optimize
- MEASURABLE: A student should know exactly when they've achieved each outcome
- PROGRESSIVE: Early outcomes are foundational, later ones are advanced
- CAREER-ALIGNED: Each outcome maps to a real skill that employers or clients value

${params.referenceDocument ? "IMPORTANT: Extract and enhance learning objectives from the provided reference document." : ""}
${params.targetAudience ? `Calibrate outcomes specifically for: ${params.targetAudience}` : ""}

Anti-patterns to AVOID:
- ❌ "Understand the basics of..."  (too vague)
- ❌ "Learn about..."  (passive, not measurable)
- ❌ "Be familiar with..."  (not actionable)

Generate outcomes for: "${courseTitle}"`,

      curriculum: `
═══ TASK: Design Comprehensive Course Curriculum ═══
Design a curriculum that feels like it was built by a senior instructor with 10+ years of teaching experience.

Structure Requirements:
- 5-10 main SECTIONS (major topic areas / chapters)
- Each section: 2-4 MODULES (sub-topics within the section)
- Each module: 3-6 LECTURES (individual lessons)
- EVERY lecture gets a realistic time estimate (e.g., "12 min", "25 min", "45 min", "1 hr")
- Order numbers start at 0 and increment sequentially

Curriculum Design Principles:
1. OPENING SECTION: Hook + setup. What are we building/learning? Why does it matter? Context setting and any required setup.
2. FOUNDATION SECTIONS: Core concepts, theory-in-practice, guided exercises.
3. INTERMEDIATE SECTIONS: Deeper dives, real-world patterns, common pitfalls.
4. ADVANCED SECTIONS: Edge cases, expert-level techniques, real-world complexity, and mastery-level skills.
5. CAPSTONE SECTION: Final project, integration, portfolio piece, next steps.

${params.lmsContent ? "CRITICAL: REAL CONTENT EXISTS: The course already has uploaded LMS content (see the ACTUAL UPLOADED COURSE CONTENT outline above). The curriculum MUST mirror that outline exactly, same sections in the same order, with the uploaded lessons as the lectures and their real durations. Do NOT invent sections, modules, or lectures that are not in the outline. You may only group the uploaded lessons into sensible modules within each section." : ""}
${params.courseDuration ? `DURATION CONSTRAINT: Total curriculum should fit within ${params.courseDuration}. Scale accordingly.` : ""}
${params.referenceDocument ? "CRITICAL: Use the reference document's structure/syllabus as the primary skeleton. Enhance with additional detail." : ""}
${params.difficultyLevel === "beginner" ? "PACING: Keep lectures shorter (10-20 min). Include recap lectures. Add 'Getting Help' modules." : ""}
${params.difficultyLevel === "advanced" ? "PACING: Lectures can be longer (20-45 min). Skip basics. Include expert-level deep-dives and advanced techniques." : ""}

Include at least:
- 1 hands-on project or practical application section
- 1 practical exercise per major topic
- An orientation or "Getting Started" lecture in the first section
- A "What's Next" or "Further Learning" lecture at the end

Generate curriculum for: "${courseTitle}"`,

      offerings: `
═══ TASK: Generate Course Offerings ═══
Create 4-6 compelling course offerings that highlight tangible value.

Available icon types: video, download, certificate, lifetime, mobile, assignment, quiz, support, project, code

Each offering should:
- Be specific with numbers where possible (e.g., "40+ hours of HD video content" not just "Video content")
- Communicate clear value to the student
- Match the ${params.flavour} flavour expectations

${params.lmsContent ? "CRITICAL: REAL CONTENT EXISTS: Derive every number from the ACTUAL UPLOADED COURSE CONTENT totals above (real video lecture count/durations, real quiz count, real assignment count). Only mention quizzes or assignments if the uploaded content actually contains them. Do NOT fabricate counts or claim materials that do not exist." : ""}

${params.flavour === "technical" || params.flavour === "data" ? "Prioritize: code examples, project files, downloadable resources, coding exercises." : ""}
${params.flavour === "professional" || params.flavour === "executive" ? "Prioritize: templates, frameworks, case studies, certificate of completion." : ""}
${params.flavour === "creative" ? "Prioritize: downloadable assets, project files, community feedback, portfolio reviews." : ""}
${params.flavour === "bootcamp" ? "Prioritize: projects, code reviews, mock interviews, career support, portfolio building." : ""}
${params.flavour === "healthcare" ? "Prioritize: clinical guides, compliance checklists, case study libraries, CE/CME tracking." : ""}
${params.flavour === "academic" ? "Prioritize: reading lists, research papers, discussion forums, analytical exercises." : ""}
${params.flavour === "beginner" ? "Prioritize: step-by-step guides, cheat sheets, beginner-friendly exercises, mentor support." : ""}
${params.flavour === "kids" ? "Prioritize: fun activities, badges, interactive challenges, parent progress reports." : ""}
${params.flavour === "lifestyle" ? "Prioritize: habit trackers, daily practice guides, printable worksheets, community access." : ""}
${params.flavour === "career" ? "Prioritize: resume templates, interview scripts, mock exercises, networking guides." : ""}
${params.flavour === "language" ? "Prioritize: conversation practice audio, vocabulary flashcards, cultural guides, pronunciation exercises." : ""}

Generate offerings for: "${courseTitle}"`,

      requirements: `
═══ TASK: Generate Prerequisites & Requirements ═══
Create 2-5 prerequisites that are:
- HONEST: Don't say "no experience needed" for an advanced course
- SPECIFIC: Name exact tools, resources, or knowledge areas needed
- HELPFUL: Include what students should prepare, gather, or set up before starting
- REALISTIC: Include time commitment expectations

${params.difficultyLevel === "beginner" ? "This is a beginner course, keep prerequisites minimal. Focus on what to prepare and the right mindset to have." : ""}
${params.difficultyLevel === "advanced" ? "This is an advanced course, be clear about required prior knowledge and experience level." : ""}
${params.referenceDocument ? "Check the reference document for any stated prerequisites." : ""}
${params.targetAudience ? `Prerequisites should be calibrated for: ${params.targetAudience}` : ""}

Generate prerequisites for: "${courseTitle}"`,

      description: `
═══ TASK: Write Course Description ═══
Write a 2-4 paragraph description in PLAIN TEXT (no HTML, no markdown, no bullet points).

Structure:
PARAGRAPH 1: THE HOOK: Why does this course exist? What problem does it solve? What opportunity does it unlock?
PARAGRAPH 2: THE JOURNEY: What will students learn? Walk through the high-level curriculum arc.
PARAGRAPH 3: THE AUDIENCE: Who is this for? Who is it NOT for? What makes this approach unique?
PARAGRAPH 4: THE OUTCOME: What will students be able to do after completing this course? Career impact.

Writing Guidelines:
- Write like a passionate expert who genuinely cares about student success.
- Use vivid, specific language, not generic marketing fluff.
- Include specific tools, methodologies, or domain-relevant details by name.
- Separate paragraphs with line breaks.
- Match the ${params.flavour} tone throughout.

${params.referenceDocument ? "IMPORTANT: Weave in key themes and specifics from the reference document." : ""}
${params.industry ? `Ground examples and relevance in the ${params.industry} industry.` : ""}

Write description for: "${courseTitle}"`,

      faqs: `
═══ TASK: Generate FAQs ═══
Create 4-8 FAQs that address REAL concerns prospective students have.

Required FAQ Categories (pick the most relevant):
1. READINESS: "Am I ready for this course?" / "What do I need to know first?"
2. TIME: "How long will this take?" / "Can I do this alongside a full-time job?"
3. CONTENT: "What topics and resources are covered?" / "Is the content up to date?"
4. VALUE: "Will I get a certificate?" / "How is this different from free resources?"
5. SUPPORT: "What if I get stuck?" / "Is there instructor support?"
6. CAREER: "Will this help me get a job?" / "What roles can I apply for after?"
7. ACCESS: "How long do I have access?" / "Can I download materials?"
8. REFUND: "What's the refund policy?"

Answer Guidelines:
- Be specific and honest, not vague and sales-y.
- Include concrete details (numbers, tool names, timeframes).
- Address the concern directly in the first sentence, then elaborate.
- Match the ${params.flavour} tone.

${params.lmsContent ? "CRITICAL: REAL CONTENT EXISTS: Ground all content-related answers (topics covered, number of lessons, quizzes, assignments, time required) in the ACTUAL UPLOADED COURSE CONTENT outline above. Reference real section/lesson topics by name; never claim content that is not in the outline." : ""}

${params.flavour === "bootcamp" ? "Include FAQ about job placement rates, portfolio building, and interview prep." : ""}
${params.flavour === "healthcare" ? "Include FAQ about CE/CME credits and clinical applicability." : ""}
${params.flavour === "academic" ? "Include FAQ about academic credit and research applications." : ""}
${params.flavour === "lifestyle" ? "Include FAQ about daily time commitment, equipment/materials needed, and realistic results timeline." : ""}
${params.flavour === "career" ? "Include FAQ about which industries/roles this applies to, and how quickly to expect results." : ""}
${params.flavour === "language" ? "Include FAQ about target proficiency level, practice time per day, and whether prior language experience is needed." : ""}

Generate FAQs for: "${courseTitle}"`,

      thumbnails: `This is for thumbnail generation, handled separately.`,
    };
  }

  /**
   * Builds section-specific prompts with flavour awareness.
   */
  private buildSectionPrompt(
    courseTitle: string,
    sectionKey: CourseAISectionKey,
    params: {
      extraContext?: string;
      flavour: CourseFlavour;
      referenceDocument?: string;
      referenceImageDescription?: string;
      targetAudience?: string;
      courseDuration?: string;
      difficultyLevel?: string;
      industry?: string;
      lmsContent?: string;
    }
  ): string {
    const basePrompt = this.buildPrompt({ courseTitle, ...params });
    const instructions = this.getSectionInstructions(courseTitle, params);

    return `${basePrompt}

${instructions[sectionKey]}`;
  }

  // ─── Main Entry Point ────────────────────────────────────────────────────

  async generateCourseContent(
    params: GenerateCourseContentParams
  ): Promise<GeneratedCourseContent> {
    const {
      courseTitle,
      sections,
      extraContext,
      thumbnailContext,
      flavour: inputFlavour,
      referenceDocument,
      referenceImageDataUrl,
      referenceImageDescription,
      targetAudience,
      courseDuration,
      difficultyLevel,
      industry,
    } = params;

    if (!courseTitle?.trim()) {
      throw new BadRequestError("Course title is required");
    }

    const validSections = sections.filter((s) => ALL_SECTION_KEYS.includes(s));
    if (validSections.length === 0) {
      throw new BadRequestError("At least one valid section is required");
    }

    // ── Auto-infer flavour if not provided ──
    // Include courseMetadata fields (subtitle, description, categories) for better inference
    const metadataContext = params.courseMetadata
      ? [params.courseMetadata.subTitle, params.courseMetadata.description, ...(params.courseMetadata.categoryNames ?? [])].filter(Boolean).join(" ")
      : undefined;
    const flavour =
      inputFlavour && inputFlavour.trim()
        ? inputFlavour
        : inferFlavour(courseTitle, [extraContext, metadataContext].filter(Boolean).join(" ") || undefined, targetAudience, industry);

    logger.info(`Course AI: Generating content for "${courseTitle}" with flavour="${flavour}"`);

    const hasThumbnails = validSections.includes("thumbnails");
    const textSections = validSections.filter((s) => s !== "thumbnails");

    const result: GeneratedCourseContent = {};

    // Build shared prompt params
    const promptParams = {
      extraContext,
      flavour,
      referenceDocument,
      referenceImageDescription,
      targetAudience,
      courseDuration,
      difficultyLevel,
      industry,
      lmsContent: params.lmsContent,
    };

    const totalStart = Date.now();
    logger.info(`[CourseAI] Starting generation for "${courseTitle}", sections: [${validSections.join(", ")}], flavour: ${flavour}`);

    try {
      // Build text generation promise
      const textPromise = textSections.length > 0
        ? (textSections.length === ALL_SECTION_KEYS.filter((s) => s !== "thumbnails").length
            ? this.generateAllSections(courseTitle, promptParams)
            : (async () => {
                const combined: Partial<GeneratedCourseContent> = {};
                for (const sectionKey of textSections) {
                  Object.assign(combined, await this.generateSingleSection(courseTitle, sectionKey, promptParams));
                }
                return combined;
              })()
          )
        : Promise.resolve({} as Partial<GeneratedCourseContent>);

      // Build thumbnail generation promise
      const thumbnailPromise = hasThumbnails
        ? this.generateThumbnails(courseTitle, flavour, extraContext, thumbnailContext, referenceImageDataUrl, params.courseMetadata)
        : Promise.resolve({} as Partial<GeneratedCourseContent>);

      // Run text + thumbnails in parallel
      const [textResult, thumbnailResult] = await Promise.all([textPromise, thumbnailPromise]);
      Object.assign(result, textResult, thumbnailResult);

      logger.info(`[CourseAI] Completed generation for "${courseTitle}" in ${Date.now() - totalStart}ms`);
      return result;
    } catch (error) {
      const elapsed = Date.now() - totalStart;
      logger.error(`[CourseAI] Error generating course content after ${elapsed}ms:`, error);
      if (error instanceof BadRequestError) {
        throw error;
      }
      // Detect timeout / abort errors
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError" || error.message.includes("timed out") || error.message.includes("aborted"))) {
        throw new BadRequestError(`AI generation timed out after ${Math.round(elapsed / 1000)}s. Please try again with fewer sections.`);
      }
      const causeMsg =
        error instanceof Error && error.cause instanceof Error
          ? error.cause.message
          : null;
      const baseMsg = error instanceof Error ? error.message : "Unknown error";
      const detail = causeMsg ? `${baseMsg} (${causeMsg})` : baseMsg;
      throw new BadRequestError(`Failed to generate course content: ${detail}`);
    }
  }

  // ─── Generate All Sections ───────────────────────────────────────────────

  private async generateAllSections(
    courseTitle: string,
    params: {
      extraContext?: string;
      flavour: CourseFlavour;
      referenceDocument?: string;
      referenceImageDescription?: string;
      targetAudience?: string;
      courseDuration?: string;
      difficultyLevel?: string;
      industry?: string;
      lmsContent?: string;
    }
  ): Promise<Partial<GeneratedCourseContent>> {
    const basePrompt = this.buildPrompt({ courseTitle, ...params });
    const instructions = this.getSectionInstructions(courseTitle, params);

    // Compose the all-in-one prompt using the SAME rich per-section instructions
    // that the individual generation path uses. This ensures identical quality
    // and domain fidelity regardless of generation mode.
    const textSectionKeys: CourseAISectionKey[] = [
      "subtitle", "learningOutcomes", "curriculum", "offerings",
      "requirements", "description", "faqs",
    ];

    const sectionBlocks = textSectionKeys
      .map((key, i) => `── SECTION ${i + 1} OF 7 ──\n${instructions[key]}`)
      .join("\n\n");

    const prompt = `${basePrompt}

═══════════════════════════════════════════════════════
TASK: Generate ALL Course Content Sections
═══════════════════════════════════════════════════════

Generate EVERY section below with maximum quality. Each section should feel like it was crafted by an expert instructor who deeply understands both the subject matter and instructional design.

CRITICAL: Determine the course's actual domain from its title and generate ALL content faithful to that domain. A fitness course must produce fitness content throughout, a career course must produce career content, a K-12 exam prep course must produce exam-relevant academic content, etc. Never default to technology, programming, or data science content unless the title explicitly indicates a tech topic. Match the ${params.flavour} flavour in every single section below.

${sectionBlocks}`;

    const start = Date.now();
    logger.info(`[CourseAI] generateAllSections starting for "${courseTitle}"`);

    const { output, usage } = await generateText({
      model: this.getModel(),
      output: Output.object({ schema: allSectionsSchema }),
      prompt,
      // The full curriculum (sections → modules → lectures) can be large;
      // 16k frequently truncated the JSON mid-structure, causing the AI SDK
      // to throw AI_NoObjectGeneratedError. 32k leaves comfortable headroom.
      maxOutputTokens: 32000,
      temperature: 0.7,
    });
    // Metered only when the agent triggered this (no-op from the dashboard).
    recordUsage({ purpose: "course", kind: "text", usage });

    logger.info(`[CourseAI] generateAllSections completed in ${Date.now() - start}ms`);

    const generatedObject = output as z.infer<typeof allSectionsSchema>;
    return {
      subTitle: generatedObject.subTitle,
      learningOutcomes: generatedObject.learningOutcomes,
      sections: generatedObject.sections,
      offerings: generatedObject.offerings,
      prerequisites: generatedObject.prerequisites,
      description: generatedObject.description,
      faqs: generatedObject.faqs,
    };
  }

  // ─── Generate Single Section ─────────────────────────────────────────────

  private async generateSingleSection(
    courseTitle: string,
    sectionKey: CourseAISectionKey,
    params: {
      extraContext?: string;
      flavour: CourseFlavour;
      referenceDocument?: string;
      referenceImageDescription?: string;
      targetAudience?: string;
      courseDuration?: string;
      difficultyLevel?: string;
      industry?: string;
    }
  ): Promise<Partial<GeneratedCourseContent>> {
    const start = Date.now();
    logger.info(`[CourseAI] generateSingleSection "${sectionKey}" starting for "${courseTitle}"`);

    const prompt = this.buildSectionPrompt(courseTitle, sectionKey, params);

    const schemaMap: Record<CourseAISectionKey, z.ZodObject<z.ZodRawShape>> = {
      subtitle: subtitleSchema,
      learningOutcomes: learningOutcomesSchema,
      curriculum: curriculumSchema,
      offerings: offeringsSchema,
      requirements: requirementsSchema,
      description: descriptionSchema,
      faqs: faqsSchema,
      thumbnails: z.object({}),
    };

    const schema = schemaMap[sectionKey];
    if (!schema || sectionKey === "thumbnails") {
      return {};
    }

    // Curriculum (nested sections/modules/lectures) is the largest payload.
    // give it generous headroom so the JSON isn't truncated mid-structure
    // (which surfaces as AI_NoObjectGeneratedError). Other sections are small.
    const maxTokensForSection = sectionKey === "curriculum" ? 16000 : 4000;

    const { output, usage } = await generateText({
      model: this.getModel(),
      output: Output.object({ schema }),
      prompt,
      maxOutputTokens: maxTokensForSection,
      temperature: 0.7,
    });
    recordUsage({ purpose: "course", kind: "text", usage });

    const keyMap: Record<CourseAISectionKey, string> = {
      subtitle: "subTitle",
      learningOutcomes: "learningOutcomes",
      curriculum: "sections",
      offerings: "offerings",
      requirements: "prerequisites",
      description: "description",
      faqs: "faqs",
      thumbnails: "webThumbnailDataUrl",
    };

    logger.info(`[CourseAI] generateSingleSection "${sectionKey}" completed in ${Date.now() - start}ms`);

    const resultKey = keyMap[sectionKey];
    const responseData = output as Record<string, unknown>;

    if (sectionKey === "curriculum") {
      return { sections: responseData.sections as GeneratedCourseContent["sections"] };
    }
    if (sectionKey === "requirements") {
      return { prerequisites: responseData.prerequisites as string[] };
    }
    if (sectionKey === "subtitle") {
      return { subTitle: responseData.subTitle as string };
    }

    return { [resultKey]: responseData[resultKey] } as Partial<GeneratedCourseContent>;
  }

  // ─── Generate Thumbnails ─────────────────────────────────────────────────

  private async generateThumbnails(
    courseTitle: string,
    flavour: CourseFlavour,
    extraContext?: string,
    thumbnailContext?: ThumbnailContext,
    referenceImageDataUrl?: string,
    courseMetadata?: GenerateCourseContentParams["courseMetadata"]
  ): Promise<Partial<GeneratedCourseContent>> {
    const courseMode = thumbnailContext?.courseMode || "";
    const startDate = thumbnailContext?.startDate || "";
    const organizationName = thumbnailContext?.organizationName || "";
    const instructorNames = thumbnailContext?.instructorNames || [];
    const batchLanguage = thumbnailContext?.batchLanguage || "";

    const formattedStartDate = startDate
      ? new Date(startDate).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";

    const courseModeLabel =
      courseMode === "LIVE"
        ? "LIVE"
        : courseMode === "HYBRID"
          ? "Hybrid"
          : courseMode === "SELF_PACED"
            ? "Self-Paced"
            : "";

    // ── Flavour → Visual Style Mapping ──
    const visualStyles: Record<string, string> = {
      technical: `
Visual Style: Dark theme with neon accent gradients (deep navy → electric blue → cyan).
Include subtle code snippets, terminal windows, or circuit-board patterns as decorative elements.
Typography: Monospace accent font for title, clean sans-serif for details.
Color palette: #0D1117, #1F6FEB, #58A6FF, #00D4AA.`,
      data: `
Visual Style: Dark-to-purple gradient with data visualization elements (scatter plots, neural network nodes, matrix rain).
Include abstract geometric patterns suggesting data flow and connections.
Typography: Modern geometric sans-serif. Clean and analytical feel.
Color palette: #1A0A2E, #7C3AED, #A78BFA, #06B6D4.`,
      creative: `
Visual Style: Bold, vibrant gradients with artistic flair (coral → magenta → violet).
Include creative tool icons, brush strokes, color swatches, or design grid elements.
Typography: Expressive display font for title, elegant sans-serif for details.
Color palette: #FF6B6B, #C44569, #9B59B6, #F8B500.`,
      professional: `
Visual Style: Premium corporate gradient (dark slate → steel blue → silver accent).
Clean, minimal design with subtle geometric shapes and professional iconography.
Typography: Premium serif or clean sans-serif. Understated elegance.
Color palette: #1E293B, #334155, #3B82F6, #F1F5F9.`,
      academic: `
Visual Style: Warm, scholarly tones (deep burgundy → warm gold → cream accent).
Include subtle book/journal patterns, mathematical symbols, or classical elements.
Typography: Serif font for title (scholarly feel), clean sans-serif for details.
Color palette: #4A1942, #8B5E3C, #D4A574, #F5E6CC.`,
      beginner: `
Visual Style: Friendly, approachable gradient (sky blue → mint green → white accents).
Rounded shapes, friendly icons, welcoming visual elements.
Typography: Rounded sans-serif. Warm and inviting.
Color palette: #4FACFE, #43E97B, #38F9D7, #FFFFFF.`,
      bootcamp: `
Visual Style: High-energy dark gradient with bold accent (black → deep red → orange fire).
Dynamic angular shapes, progress bars, rocket/launch imagery.
Typography: Bold, condensed sans-serif. Impact and urgency.
Color palette: #0F0F0F, #DC2626, #F97316, #FCD34D.`,
      executive: `
Visual Style: Ultra-premium dark gradient (black → dark gold → champagne accent).
Minimal, sophisticated design with thin gold lines and premium feel.
Typography: Elegant thin serif or premium sans-serif. Luxury feel.
Color palette: #0A0A0A, #B8860B, #DAA520, #F5F5DC.`,
      kids: `
Visual Style: Playful, colorful gradient (purple → pink → yellow → cyan).
Fun shapes, stars, emojis, game-like elements, cartoon style.
Typography: Rounded, bubbly font. Fun and engaging.
Color palette: #8B5CF6, #EC4899, #F59E0B, #06B6D4.`,
      healthcare: `
Visual Style: Clean medical gradient (teal → white → light blue accent).
Include subtle medical symbols (stethoscope, heartbeat line, DNA helix).
Typography: Clean, trustworthy sans-serif. Professional medical feel.
Color palette: #0D9488, #14B8A6, #67E8F9, #F0FDFA.`,
      lifestyle: `
Visual Style: Warm, inviting gradient (soft coral → blush pink → warm cream).
Include lifestyle imagery: wellness icons, nature elements, balanced compositions.
Typography: Modern rounded sans-serif. Warm and approachable.
Color palette: #FF6B6B, #FCA5A5, #FDE68A, #FFFBEB.`,
      career: `
Visual Style: Confident, professional gradient (deep charcoal → royal blue → silver).
Include career imagery: upward arrows, milestone markers, professional silhouettes.
Typography: Bold, modern sans-serif. Confident and professional.
Color palette: #1E293B, #2563EB, #60A5FA, #F8FAFC.`,
      language: `
Visual Style: Vibrant, multicultural gradient (indigo → emerald → warm amber).
Include language/cultural elements: speech bubbles, globe, script characters, flags.
Typography: Clean, international sans-serif that works across scripts.
Color palette: #312E81, #059669, #F59E0B, #ECFDF5.`,
    };

    const visualStyle =
      visualStyles[flavour] ||
      `
Visual Style: Modern professional gradient matching the "${flavour}" theme.
Choose colors and elements that best represent this domain.
Typography: Clean, modern sans-serif appropriate for the subject matter.`;

    const referenceImageInstruction = referenceImageDataUrl
      ? `
REFERENCE BRAND STYLE: A brand reference was provided by the course creator.${organizationName ? `\n- Maintain visual consistency with typical branding for "${organizationName}".` : ""}
- Use professional design language matching this domain's aesthetic expectations.`
      : "";

    const basePrompt = `Create a professional course thumbnail image that FILLS THE ENTIRE CANVAS with NO borders, NO margins, NO empty space, and NO white/gray backgrounds around the edges.

${visualStyle}
${referenceImageInstruction}

Course Details to incorporate:
- Course Title: "${courseTitle}" (display prominently in large, bold, high-contrast text with metallic or glowing text effects)
${instructorNames.length > 0 ? `- Instructor(s): ${instructorNames.join(", ")}` : ""}
${batchLanguage ? `- Language: "${batchLanguage}"` : ""}
${courseModeLabel ? `- Course Mode: "${courseModeLabel}" (${courseModeLabel === "LIVE" ? "include a prominent LIVE badge/button with pulsing-dot aesthetic in gold or orange, positioned top-left" : "display as a subtle badge"})` : ""}
${formattedStartDate ? `- Start Date: "${formattedStartDate}" (display with a calendar icon, positioned near the bottom)` : ""}
${organizationName ? `- Organization: "${organizationName}" (display as logo text in the top-right corner with subtle opacity)` : ""}
${organizationName ? `- Reserve a small spot in the top-right for a "${organizationName}" logo watermark.` : ""}
${extraContext ? `- Additional Context: ${extraContext}` : ""}
${this.buildCourseMetadataBlock(courseMetadata)}
CRITICAL Design Requirements:
1. FULL-BLEED: Design extends to ALL edges. Zero padding, zero borders, zero empty space.
2. TYPOGRAPHY: Title is the hero element, large, bold, high contrast against the gradient. Use metallic or glowing text effects for visual impact.
3. HIERARCHY: Title${instructorNames.length > 0 ? " → Instructor(s)" : ""}${courseModeLabel ? " → Mode Badge" : ""}${formattedStartDate ? " → Date" : ""}${organizationName ? " → Organization" : ""} (in order of visual weight).
4. DEPTH: Use layered gradients, subtle shadows, glassmorphism effects, and 3D effects for modern depth.
5. VISUAL ELEMENTS: Include relevant vector illustrations, visual motifs, and design elements that match the course's specific domain and topic.
6. CONTRAST: Ensure all text is clearly readable against the background.
7. PROFESSIONAL: This should look like it was designed by a world-class professional graphic designer. Premium, polished, publication-ready quality.
8. TEXT ACCURACY: Every word, name, and date rendered in the image MUST be spelled correctly with ZERO grammatical errors. Double-check all text before rendering.
${instructorNames.length > 0 ? `9. NAME RENDERING: Instructor names must be displayed coherently, completely, and professionally, never truncated, garbled, or misspelled.` : ""}
CRITICAL: TEXT INTEGRITY:
- ONLY render text that is EXPLICITLY provided in "Course Details to incorporate" above. Do NOT invent, fabricate, or add any names, dates, organizations, or text that are not listed above.
- Do NOT render any subtitle, tagline, description, or metadata as text in the image. The ONLY text in the image should be what's listed under "Course Details to incorporate" above.
- If no instructor names are provided, do NOT display any instructor or mentor names.
- If no organization is provided, do NOT display any organization, company logo, or brand name.
- If no start date is provided, do NOT display any date.`;

    const webPrompt = `${basePrompt}

FORMAT: FULL-BLEED LANDSCAPE image (16:9 aspect ratio) for web display.
Layout: Course title and details on the LEFT 60%, visual/abstract elements on the RIGHT 40%.
${organizationName ? "Organization logo anchored to top-right corner." : ""}
${courseModeLabel === "LIVE" ? "LIVE badge positioned in the top-left area." : ""}`;

    const mobilePrompt = `Create a visually stunning, minimal course thumbnail image that FILLS THE ENTIRE CANVAS with NO borders, NO margins, NO empty space.

${visualStyle}
${referenceImageInstruction}

This is for the course: "${courseTitle}"

FORMAT: FULL-BLEED PORTRAIT image (9:16 aspect ratio) for mobile display.

MOBILE DESIGN RULES:
1. MINIMAL TEXT: Only display the course title: NO instructor names, NO dates, NO language, NO mode badges, NO organization text. The title is the ONLY text element.
2. VISUAL-FIRST: 70% of the canvas should be bold, eye-catching visual elements, abstract art, gradients, and illustrations related to the course topic.
3. TITLE PLACEMENT: Course title in the upper third, large and bold with high contrast. Keep it short and impactful.
4. BREATHING ROOM: Generous whitespace/negative space around the title. Let the visuals speak.
5. FULL-BLEED: Design extends to ALL edges. Zero padding, zero borders.
6. DEPTH: Rich layered gradients, glassmorphism, 3D elements, glowing particles for a premium feel.
7. SCROLL-STOPPING: This should look like a premium app store feature graphic, bold, clean, and instantly appealing on a small screen.`;

    const pipelineStart = Date.now();
    logger.info(`[CourseAI] generateThumbnails starting for "${courseTitle}"`);

    try {
      const apiStart = Date.now();
      logger.info(`[CourseAI] image generation starting`);

      // Returns undefined when image generation is off (no AI_IMAGE_MODEL).
      const generateImage = async (prompt: string, aspectRatio: string): Promise<string | undefined> => {
        const image = await generateAiImage({ purpose: "course", prompt, aspectRatio });
        return image?.base64;
      };

      const [webB64, mobileB64] = await Promise.all([
        generateImage(webPrompt, "16:9"),
        generateImage(mobilePrompt, "9:16"),
      ]);

      logger.info(`[CourseAI] image generation completed in ${Date.now() - apiStart}ms`);

      let webThumbnailDataUrl: string | undefined;
      let mobileThumbnailDataUrl: string | undefined;

      const optimizeStart = Date.now();
      if (webB64) {
        webThumbnailDataUrl = await this.optimizeThumbnail(webB64);
      }

      if (mobileB64) {
        mobileThumbnailDataUrl = await this.optimizeThumbnail(mobileB64);
      }
      logger.info(`[CourseAI] Thumbnail optimization completed in ${Date.now() - optimizeStart}ms`);

      logger.info(`[CourseAI] generateThumbnails total pipeline completed in ${Date.now() - pipelineStart}ms`);
      return { webThumbnailDataUrl, mobileThumbnailDataUrl };
    } catch (error) {
      logger.error(`[CourseAI] Error generating thumbnails after ${Date.now() - pipelineStart}ms:`, error);
      if (error instanceof BadRequestError) {
        throw error;
      }
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError" || error.message.includes("timed out") || error.message.includes("aborted"))) {
        throw new BadRequestError("Thumbnail generation timed out. Please try again.");
      }
      throw new BadRequestError(
        `Failed to generate thumbnails: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

export const courseAIService = new CourseAIService();
export default courseAIService;
