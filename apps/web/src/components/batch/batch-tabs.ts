/**
 * Single source of truth for batch tab keys + URL parsing. Imported by both
 * the pill nav and the consolidated detail client so they can never drift.
 */

export type BatchTabKey =
  | "overview"
  | "about"
  | "content"
  | "leaderboard";

export const VALID_BATCH_TABS: BatchTabKey[] = [
  "overview",
  "about",
  "content",
  "leaderboard",
];

export function isValidBatchTab(value: string | null | undefined): value is BatchTabKey {
  return !!value && (VALID_BATCH_TABS as string[]).includes(value);
}

/** Default tab: enrolled members land on Overview, everyone else on About. */
export function defaultBatchTab(hasAccess: boolean): BatchTabKey {
  return hasAccess ? "overview" : "about";
}
