/**
 * Offline accuracy eval for the onboarding template picker.
 *
 * Prints, for a matrix of representative signup scenarios, which template +
 * theme the wizard would choose. Two columns:
 *   - deterministic: `pickDefaultTemplate` (the safe fallback + the AI model anchor)
 *   - ai:        the real `pickTemplateAndTheme` call (only with --live
 *                    AND a configured AI_API_KEY; otherwise skipped)
 *
 * Usage:
 *   npx tsx scripts/eval-template-pick.ts            # deterministic only (fast, free)
 *   npx tsx scripts/eval-template-pick.ts --live   # also run the live AI picker
 */
import "dotenv/config";
import { pickDefaultTemplate } from "../src/lib/creator-intent/template-mapping";
import type { QuizAnswers } from "../src/lib/creator-intent/types";
import academyPickAIService from "../src/services/academy-pick-ai.service";

const RUN_LIVE_AI = process.argv.includes("--live");

const base: Omit<QuizAnswers, "creator_type"> = {
  course_type: "Recorded courses",
  business_stage: "0–100",
  revenue_intent: "₹50k–₹2L",
  current_tools: [],
};

interface Scenario {
  label: string;
  org: string;
  creator_type: QuizAnswers["creator_type"];
  expected: string; // expected template family for a quick eyeball
}

const SCENARIOS: Scenario[] = [
  { label: "Coding academy", org: "CodeWithHarsh", creator_type: "Engineering / coding", expected: "code-tech" },
  { label: "JEE coaching", org: "JEE Rankers", creator_type: "Competitive exams", expected: "examprep" },
  { label: "UPSC coaching", org: "UPSC Adda", creator_type: "Competitive exams", expected: "govtexam" },
  { label: "Fitness studio", org: "FitLife", creator_type: "Fitness", expected: "mindfulness/fitness" },
  { label: "Corporate training", org: "UpskillPro", creator_type: "Business coaching", expected: "corpupskill/business" },
  { label: "Language school", org: "Spanish Fluently", creator_type: "Language", expected: "language/basic" },
  { label: "Pottery & crafts", org: "Clay Studio", creator_type: "Arts & Design", expected: "arts-crafts" },
  { label: "Guitar lessons", org: "String Theory Music", creator_type: "Music", expected: "music" },
  { label: "Baking academy", org: "The Baking Lab", creator_type: "Cooking", expected: "cooking" },
  { label: "Kids tutoring", org: "Little Genius", creator_type: "Kids education", expected: "kids" },
  { label: "Quant finance", org: "Quant Institute", creator_type: "Finance / Trading", expected: "quant-finance" },
  { label: "Stock trading", org: "Stock Market Pro", creator_type: "Finance / Trading", expected: "finance-markets" },
  { label: "Personal finance", org: "Wealth Builders", creator_type: "Finance / Trading", expected: "finance" },
  { label: "Astrology (Other)", org: "Astro Guru Kundali", creator_type: "Other", expected: "astrology" },
  { label: "Photography (Other)", org: "Lens Masters", creator_type: "Other", expected: "photography" },
  { label: "Trading name (Other)", org: "Nifty Trading Gurukul", creator_type: "Other", expected: "finance-markets" },
];

async function main() {
  console.log(
    `\nTemplate-pick eval, deterministic${RUN_LIVE_AI ? " + ai" : " only (pass --live for live AI)"}\n`,
  );
  const rows: Record<string, string>[] = [];
  for (const sc of SCENARIOS) {
    const answers: QuizAnswers = { ...base, creator_type: sc.creator_type };
    const det = pickDefaultTemplate(answers, sc.org);
    const row: Record<string, string> = {
      scenario: sc.label,
      org: sc.org,
      creator_type: sc.creator_type,
      expected: sc.expected,
      deterministic: `${det.template_id} / ${det.theme_id}`,
    };
    if (RUN_LIVE_AI) {
      const { pick, source } = await academyPickAIService.pickTemplateAndTheme({
        quiz_answers: answers,
        org_name: sc.org,
        deterministic_default: {
          template_id: det.template_id,
          theme_id: det.theme_id,
        },
      });
      row.ai = `${pick.template_id} / ${pick.theme_id} (${source})`;
    }
    rows.push(row);
  }
  console.table(rows);
  console.log(
    `\n${SCENARIOS.length} scenarios. Compare "deterministic"/"ai" vs "expected".\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
