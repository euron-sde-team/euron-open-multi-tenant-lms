import type { QuizAnswers } from "@open-mtlms/shared";

// Verbatim from the plan's feedback doc. Order matters, auto-advance on
// single-select answers; multi-select question shows "Next" button.
export interface QuizQuestion {
  id: keyof QuizAnswers;
  label: string;
  helper?: string;
  multi: boolean;
  options: string[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "course_type",
    label: "What do you want to sell?",
    helper: "Pick the format that best matches your teaching",
    multi: false,
    options: [
      "Recorded courses",
      "Live classes",
      "Cohort programs",
      "Test series",
      "Community",
      "Mentorship",
    ],
  },
  {
    id: "creator_type",
    label: "What category best describes you?",
    helper: "We'll match a homepage design and brand colours",
    multi: false,
    options: [
      "Engineering / coding",
      "School coaching",
      "Competitive exams",
      "Fitness",
      "Business coaching",
      "Language",
      "Arts & Design",
      "Music",
      "Cooking",
      "Kids education",
      "Finance / Trading",
      "Other",
    ],
  },
  {
    id: "business_stage",
    label: "How many students do you currently have?",
    helper: "An honest answer helps us pick the right starting price",
    multi: false,
    options: ["0–100", "100–1000", "1000–10000", "10000+"],
  },
  {
    id: "revenue_intent",
    label: "Monthly income target from teaching?",
    helper: "We'll suggest pricing, you can edit it later",
    multi: false,
    options: ["Below ₹50k", "₹50k–₹2L", "₹2L–₹10L", "₹10L+"],
  },
  {
    id: "current_tools",
    label: "Current tools you use",
    helper: "Select all that apply (or skip)",
    multi: true,
    options: [
      "Zoom",
      "YouTube",
      "WhatsApp",
      "Google Drive",
      "Udemy",
      "Offline coaching",
    ],
  },
];

export const TOTAL_STEPS = QUIZ_QUESTIONS.length + 2; // welcome + quiz + org-name
