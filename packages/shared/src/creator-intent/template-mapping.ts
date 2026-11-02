import type {
  CategorySlug,
  QuizAnswers,
  TemplateId,
  ThemeId,
} from "./types";

interface TemplatePick {
  template_id: TemplateId;
  theme_id: ThemeId;
  category_slug: CategorySlug;
}

const KEYWORDS = {
  examprep: /\b(jee|neet|iit|aiims|olympiad)\b/i,
  govtexam: /\b(upsc|ssc|banking|railway|govt|government|police|defence|defense)\b/i,
  photography: /\b(photo|photography|lens|camera|cinematography|videography)\b/i,
  astrology: /\b(astro|astrology|tarot|zodiac|kundali|horoscope|vedic)\b/i,
};

// Deterministic table, the safe-fallback when Gemini is unavailable, AND
// the seed hint passed to Gemini so its inference stays anchored to the
// closed enum of templates.
export function pickDefaultTemplate(
  answers: QuizAnswers,
  orgName: string,
): TemplatePick {
  const name = orgName ?? "";
  const tools = (answers.current_tools ?? []).join(" ");
  const corpus = `${name} ${tools}`;

  switch (answers.creator_type) {
    case "Engineering / coding":
      return {
        template_id: "code-tech",
        theme_id: "shadcn-midnight",
        category_slug: "coding",
      };

    case "Competitive exams":
      if (KEYWORDS.examprep.test(corpus)) {
        return {
          template_id: "examprep",
          theme_id: "examprep-academic",
          category_slug: "examprep",
        };
      }
      // Default for competitive exams = government / civil services prep.
      return {
        template_id: "govtexam",
        theme_id: "govtexam-warm",
        category_slug: "govtexam",
      };

    case "Fitness":
      return {
        template_id: "mindfulness",
        theme_id: "mindfulness",
        category_slug: "mindfulness",
      };

    case "Business coaching":
      return {
        template_id: "corpupskill",
        theme_id: "corpupskill-slate",
        category_slug: "corpupskill",
      };

    case "School coaching":
      return {
        template_id: "basic",
        theme_id: "default",
        category_slug: "generic",
      };

    case "Language":
      return {
        template_id: "basic",
        theme_id: "coral-warm",
        category_slug: "generic",
      };

    case "Other":
    default:
      if (KEYWORDS.photography.test(corpus)) {
        return {
          template_id: "photography",
          theme_id: "photography-brutalist",
          category_slug: "photography",
        };
      }
      if (KEYWORDS.astrology.test(corpus)) {
        return {
          template_id: "astrology",
          theme_id: "astrology-cosmic",
          category_slug: "astrology",
        };
      }
      return {
        template_id: "basic",
        theme_id: "sunset-orange",
        category_slug: "generic",
      };
  }
}
