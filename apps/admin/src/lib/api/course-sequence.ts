import { apiClient } from "./axios";

/**
 * SEQUENTIAL COURSES.
 *
 * A course can require another to be finished first: A → B → C.
 *
 * Two levels, and they mean different things:
 *
 *   The MASTER SWITCH (tenant-wide), is sequencing enforced at all?
 *   The PREREQUISITE (per course), what must be finished before this one?
 *
 * Turning the master switch off does NOT clear anyone's prerequisites: the
 * chain is kept exactly as built and simply stops being enforced, so switching
 * back on restores it untouched. "Off" never means "still enforcing but hidden"
 * (locked learners with no UI to free them) and never means "delete the chains"
 * (a misclick destroying real work).
 */

export interface SequenceStep {
  id: string;
  title: string;
  slug: string;
  thumbnail_key: string | null;
  /** NULL = the start of the chain; anyone can begin here. */
  unlocks_after_id: string | null;
  unlocks_after_type: "COURSE" | "BOOK" | "TEST_SERIES" | null;
}

export interface SequenceSettings {
  enabled: boolean;
  enabled_at: string | null;
  /** Courses that still have a prerequisite, kept even while OFF. */
  chained_courses: number;
}

export const courseSequenceApi = {
  /** The tenant-wide master switch. */
  getSettings: async () =>
    (await apiClient.get("/tenant/courses/sequence-settings")).data
      .data as SequenceSettings,

  updateSettings: async (enabled: boolean) =>
    (await apiClient.put("/tenant/courses/sequence-settings", { enabled })).data
      .data as SequenceSettings,

  /** The whole chain this course sits in, in order, not just its one link. */
  getSequence: async (courseId: string) =>
    (await apiClient.get(`/tenant/courses/${courseId}/sequence`)).data
      .data as { steps: SequenceStep[] },

  /** What finishing this course opens. Derived server-side, never stored. */
  getUnlocks: async (courseId: string) =>
    (await apiClient.get(`/tenant/courses/${courseId}/unlocks`)).data
      .data as SequenceStep[],

  /** Set what this course waits for, or pass null to clear it (= off). */
  setPrerequisite: async (
    courseId: string,
    requires: { id: string; type: "COURSE" } | null
  ) =>
    (
      await apiClient.put(`/tenant/courses/${courseId}/prerequisite`, {
        requires,
      })
    ).data,

  /** Rewrite a whole chain from an ordered list. Each waits for the one above. */
  saveSequence: async (courseId: string, courseIds: string[]) =>
    (
      await apiClient.put(`/tenant/courses/${courseId}/sequence`, { courseIds })
    ).data,

  /** The whole tenant chain, head to tail. For the sequence builder. */
  getChain: async () =>
    ((await apiClient.get("/tenant/courses/sequence")).data.data
      ?.steps ?? []) as SequenceStep[],

  /** Save the whole ordered chain at once (course-agnostic). */
  saveChain: async (courseIds: string[]) =>
    (await apiClient.put("/tenant/courses/sequence", { courseIds })).data,
};
