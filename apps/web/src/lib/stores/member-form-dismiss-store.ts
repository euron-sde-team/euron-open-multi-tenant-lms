import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Tracks when a member dismissed an OPTIONAL profile form, keyed per
 * tenant+member so a shared browser never leaks one user's dismissal onto
 * another account (see lesson: persisted state must be user-scoped). The guard
 * re-shows the form once `repromptAfterHours` has elapsed since the stored
 * timestamp; a completed form is tracked server-side and never re-prompts.
 */
interface MemberFormDismissState {
  dismissedAt: Record<string, number>;
  dismiss: (key: string) => void;
  getDismissedAt: (key: string) => number | undefined;
}

export const useMemberFormDismissStore = create<MemberFormDismissState>()(
  persist(
    (set, get) => ({
      dismissedAt: {},
      dismiss: (key) =>
        set((state) => ({
          dismissedAt: { ...state.dismissedAt, [key]: Date.now() },
        })),
      getDismissedAt: (key) => get().dismissedAt[key],
    }),
    { name: "member-form-dismiss" }
  )
);
