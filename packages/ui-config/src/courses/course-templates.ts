import type { CourseTemplateConfig, CourseFormData } from "@open-mtlms/shared";
import { getCourseThemeConfig } from "./course-themes";

// Helper to create default offerings
const defaultOfferings = [
  { id: "off-1", icon: "video", text: "Full HD video lectures" },
  { id: "off-2", icon: "download", text: "Downloadable resources" },
  { id: "off-3", icon: "certificate", text: "Certificate of completion" },
  { id: "off-4", icon: "lifetime", text: "Lifetime access" },
  { id: "off-5", icon: "mobile", text: "Access on mobile and TV" },
];

// Default learning outcomes
const defaultLearningOutcomes = [
  "Understand core concepts and fundamentals",
  "Build practical, real-world projects",
  "Learn industry best practices",
  "Gain hands-on experience with tools",
];

// Default FAQs
const defaultFAQs = [
  {
    id: "faq-1",
    question: "How long do I have access to the course?",
    answer: "You get lifetime access to all course materials. Learn at your own pace, anytime, anywhere.",
  },
  {
    id: "faq-2",
    question: "Is there a certificate of completion?",
    answer: "Yes! Upon completing the course, you'll receive a certificate that you can share on LinkedIn and your resume.",
  },
  {
    id: "faq-3",
    question: "What if I need help during the course?",
    answer: "Reach out to the instructor from the course page. We are here to help.",
  },
];

// Default sections for syllabus (3-level: Section → Module → Lecture)
const defaultSections = [
  {
    id: "sec-1",
    title: "Getting Started",
    order: 0,
    modules: [
      {
        id: "mod-1",
        title: "Introduction",
        order: 0,
        lectures: [
          { id: "lec-1", title: "Welcome & Course Overview", order: 0 },
          { id: "lec-2", title: "Setting Up Your Environment", order: 1 },
          { id: "lec-3", title: "Understanding the Basics", order: 2 },
        ],
      },
    ],
  },
  {
    id: "sec-2",
    title: "Core Concepts",
    order: 1,
    modules: [
      {
        id: "mod-2",
        title: "Fundamentals",
        order: 0,
        lectures: [
          { id: "lec-4", title: "Fundamental Principles", order: 0 },
          { id: "lec-5", title: "Practical Applications", order: 1 },
          { id: "lec-6", title: "Hands-on Exercise", order: 2 },
        ],
      },
    ],
  },
  {
    id: "sec-3",
    title: "Advanced Topics",
    order: 2,
    modules: [
      {
        id: "mod-3",
        title: "Deep Dive",
        order: 0,
        lectures: [
          { id: "lec-7", title: "Deep Dive", order: 0 },
          { id: "lec-8", title: "Best Practices", order: 1 },
          { id: "lec-9", title: "Final Project", order: 2 },
        ],
      },
    ],
  },
];

// ============ COURSE TEMPLATES ============

/**
 * Self-Paced Course Template
 * Standard online course with pre-recorded content
 */
export const selfPacedCourseTemplate: CourseTemplateConfig = {
  id: "self-paced",
  name: "Self-Paced Course",
  description: "Standard online course with pre-recorded video content. Students learn at their own pace.",
  thumbnail: "/templates/self-paced.jpg",
  mode: "SELF_PACED",
  type: "NORMAL",
  defaultTheme: getCourseThemeConfig("ocean-blue"),
  defaultContent: {
    title: "Complete Course Title",
    subTitle: "Master the fundamentals and advanced concepts with hands-on projects",
    description: `<p>Welcome to this comprehensive course designed to take you from beginner to proficient.</p>
<p>In this course, you'll learn through a combination of video lectures, hands-on exercises, and real-world projects. Whether you're just starting out or looking to level up your skills, this course has something for everyone.</p>
<h3>What makes this course special?</h3>
<ul>
<li>Clear, concise explanations of complex topics</li>
<li>Practical examples and real-world applications</li>
<li>Downloadable resources and cheat sheets</li>
<li>Instructor support</li>
</ul>`,
    duration: "20 hours",
    mode: "SELF_PACED",
    type: "NORMAL",
    purchaseMode: "PAID",
    status: "DRAFT",
    language: "English",
    weight: 0,
    isYoungCourse: false,
    individualPricing: true,
    webPriceINR: 4999,
    mobilePriceINR: 3999,
    webPriceUSD: 59,
    mobilePriceUSD: 49,
    webDiscount: 0,
    mobileDiscount: 0,
    learningOutcomes: defaultLearningOutcomes,
    prerequisites: ["Basic computer skills", "Eagerness to learn"],
    sections: defaultSections,
    offerings: defaultOfferings,
    faqs: defaultFAQs,
  } as Partial<CourseFormData>,
};

// Export all templates
export const courseTemplates: CourseTemplateConfig[] = [
  selfPacedCourseTemplate,
];

/**
 * Get course template by ID
 */
export function getCourseTemplate(id: string): CourseTemplateConfig | undefined {
  return courseTemplates.find((template) => template.id === id);
}

/**
 * Get all course templates
 */
export function getAllCourseTemplates(): CourseTemplateConfig[] {
  return courseTemplates;
}

/**
 * Apply template to form data
 */
export function applyTemplateToFormData(
  templateId: string,
  existingData?: Partial<CourseFormData>
): CourseFormData {
  const template = getCourseTemplate(templateId);
  
  if (!template) {
    // Return default self-paced template content
    return {
      ...selfPacedCourseTemplate.defaultContent,
      theme: selfPacedCourseTemplate.defaultTheme,
      ...existingData,
    } as CourseFormData;
  }

  return {
    ...template.defaultContent,
    theme: template.defaultTheme,
    ...existingData,
  } as CourseFormData;
}
