// Mirror of packages/shared/src/creator-intent/template-mapping.ts.
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
  govtexam:
    /\b(upsc|ssc|banking|railway|govt|government|police|defence|defense)\b/i,
  photography: /\b(photo|photography|lens|camera|cinematography|videography)\b/i,
  astrology: /\b(astro|astrology|tarot|zodiac|kundali|horoscope|vedic)\b/i,
  // Finance sub-niches: quant (most specific) → trading/markets → general.
  quant: /\b(quant|quantitative|algorithmic|algo|derivatives|hedge)\b/i,
  trading:
    /\b(trading|trader|market|markets|stock|stocks|forex|equity|equities)\b/i,
  cooking: /\b(cook|cooking|baking|bakery|culinary|chef|recipe|food)\b/i,
  music: /\b(music|guitar|piano|singing|vocal|audio|studio|dj)\b/i,
  arts: /\b(art|arts|craft|crafts|painting|paint|pottery|sketch|calligraphy)\b/i,
};

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
    case "Finance / Trading":
      // Most specific first: quantitative/algorithmic → quant; general
      // trading/markets → markets variant; otherwise investing/finance.
      if (KEYWORDS.quant.test(corpus)) {
        return {
          template_id: "quant-finance",
          theme_id: "quant-navy",
          category_slug: "generic",
        };
      }
      if (KEYWORDS.trading.test(corpus)) {
        return {
          template_id: "finance-markets",
          theme_id: "fintech-emerald",
          category_slug: "generic",
        };
      }
      return {
        template_id: "finance",
        theme_id: "fintech-emerald",
        category_slug: "generic",
      };
    case "Arts & Design":
      return {
        template_id: "arts-crafts",
        theme_id: "artisan-craft",
        category_slug: "generic",
      };
    case "Music":
      return {
        template_id: "music",
        theme_id: "studio-sound",
        category_slug: "generic",
      };
    case "Cooking":
      return {
        template_id: "cooking",
        theme_id: "culinary-warmth",
        category_slug: "generic",
      };
    case "Kids education":
      return {
        template_id: "kids",
        theme_id: "kids-bright",
        category_slug: "generic",
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
      // Niche routing for "Other": lets a themed org name still land on a
      // matching template even when the creator didn't pick a niche category.
      if (KEYWORDS.quant.test(corpus)) {
        return {
          template_id: "quant-finance",
          theme_id: "quant-navy",
          category_slug: "generic",
        };
      }
      if (KEYWORDS.trading.test(corpus)) {
        return {
          template_id: "finance-markets",
          theme_id: "fintech-emerald",
          category_slug: "generic",
        };
      }
      if (KEYWORDS.cooking.test(corpus)) {
        return {
          template_id: "cooking",
          theme_id: "culinary-warmth",
          category_slug: "generic",
        };
      }
      if (KEYWORDS.music.test(corpus)) {
        return {
          template_id: "music",
          theme_id: "studio-sound",
          category_slug: "generic",
        };
      }
      if (KEYWORDS.arts.test(corpus)) {
        return {
          template_id: "arts-crafts",
          theme_id: "artisan-craft",
          category_slug: "generic",
        };
      }
      return {
        template_id: "basic",
        theme_id: "sunset-orange",
        category_slug: "generic",
      };
  }
}
