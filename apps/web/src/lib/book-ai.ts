/**
 * Reader AI helpers (book summary, explain selection).
 *
 * The learner API in this build does not ship the `/book-ai/*` endpoints, so
 * the reader hides its AI buttons unless NEXT_PUBLIC_BOOK_AI_ENABLED=true is set
 * for a deployment that adds them.
 */
import { apiPost } from "@/lib/api/api-client";

export const BOOK_AI_ENABLED = process.env.NEXT_PUBLIC_BOOK_AI_ENABLED === "true";

const AI_TIMEOUT_MS = 60_000;

export async function generateBookSummary(bookTitle: string, bookContent: string): Promise<string> {
  const data = await apiPost<{ summary?: string }>(
    "/book-ai/summary",
    { bookTitle, bookContent },
    { timeout: AI_TIMEOUT_MS }
  );
  const summary = data?.summary?.trim();
  if (!summary) throw new Error("Could not generate the summary. Please try again.");
  return summary;
}

export async function explainSelectedText(
  selectedText: string,
  bookTitle: string,
  surroundingContext?: string
): Promise<string> {
  const data = await apiPost<{ explanation?: string }>(
    "/book-ai/explain",
    { selectedText, bookTitle, surroundingContext },
    { timeout: AI_TIMEOUT_MS }
  );
  const explanation = data?.explanation?.trim();
  if (!explanation) throw new Error("Could not generate the explanation. Please try again.");
  return explanation;
}
