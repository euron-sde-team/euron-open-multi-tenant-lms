import { create } from "zustand";
import type {
  AdaptiveAttemptInfo,
  AttemptState,
  AttemptQuestion,
} from "@/lib/api/test-series";

interface AnswerEntry {
  answer: unknown;
  markedForReview: boolean;
  /** True once the learner has interacted with this question (visited) */
  visited: boolean;
}

interface QuestionTimeEntry {
  /** Milliseconds spent across all visits to this question */
  totalMs: number;
  /** When the question became active (null when not currently focused) */
  enteredAtMs: number | null;
}

interface TestAttemptStore {
  attemptId: string | null;
  testId: string | null;
  seriesId: string | null;

  /** Hard expiry: started_at + duration */
  expiresAtMs: number | null;
  totalDurationSec: number;

  sections: AttemptState["sections"];
  /** All questions, keyed by id */
  questionsById: Record<string, AttemptQuestion>;
  /** First question id of each section, derived */
  questionOrder: string[];

  currentQuestionId: string | null;
  answers: Record<string, AnswerEntry>;
  questionTime: Record<string, QuestionTimeEntry>;
  status: "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED" | "IDLE";
  mode: "STANDARD" | "ADAPTIVE";
  /** ADAPTIVE attempts: current-module progress; the envelope is module-scoped. */
  adaptive: AdaptiveAttemptInfo | null;

  // ---- actions ----
  hydrate: (state: AttemptState) => void;
  setCurrentQuestion: (questionId: string) => void;
  setAnswer: (questionId: string, answer: unknown) => void;
  toggleMarkForReview: (questionId: string) => void;
  clearAnswer: (questionId: string) => void;
  submitFinalize: (status: "SUBMITTED" | "AUTO_SUBMITTED") => void;
  reset: () => void;

  // selectors
  getQuestionTimeSec: (questionId: string) => number;
}

const INITIAL: Omit<
  TestAttemptStore,
  | "hydrate"
  | "setCurrentQuestion"
  | "setAnswer"
  | "toggleMarkForReview"
  | "clearAnswer"
  | "submitFinalize"
  | "reset"
  | "getQuestionTimeSec"
> = {
  attemptId: null,
  testId: null,
  seriesId: null,
  expiresAtMs: null,
  totalDurationSec: 0,
  sections: [],
  questionsById: {},
  questionOrder: [],
  currentQuestionId: null,
  answers: {},
  questionTime: {},
  status: "IDLE",
  mode: "STANDARD",
  adaptive: null,
};

function flushCurrentTimer(state: TestAttemptStore): TestAttemptStore {
  const qid = state.currentQuestionId;
  if (!qid) return state;
  const entry = state.questionTime[qid];
  if (!entry || entry.enteredAtMs === null) return state;
  const elapsed = Math.max(0, Date.now() - entry.enteredAtMs);
  return {
    ...state,
    questionTime: {
      ...state.questionTime,
      [qid]: { totalMs: entry.totalMs + elapsed, enteredAtMs: null },
    },
  };
}

export const useTestAttemptStore = create<TestAttemptStore>((set, get) => ({
  ...INITIAL,

  hydrate: (s) => {
    const questionsById: Record<string, AttemptQuestion> = {};
    for (const q of s.questions) questionsById[q.id] = q;
    const questionOrder: string[] = [];
    for (const sec of s.sections) for (const qid of sec.questionIds) questionOrder.push(qid);

    // Existing answers from server
    const answers: Record<string, AnswerEntry> = {};
    for (const [qid, val] of Object.entries(s.answers ?? {})) {
      answers[qid] = {
        answer: val.answer,
        markedForReview: !!val.markedForReview,
        visited: true,
      };
    }

    const questionTime: Record<string, QuestionTimeEntry> = {};
    for (const qid of questionOrder)
      questionTime[qid] = { totalMs: 0, enteredAtMs: null };

    const startedAtMs = s.startedAt ? new Date(s.startedAt).getTime() : Date.now();
    // Adaptive attempts run on per-module deadlines, not the attempt clock.
    const expiresAtMs =
      s.mode === "ADAPTIVE"
        ? s.adaptive?.moduleDeadline
          ? new Date(s.adaptive.moduleDeadline).getTime()
          : null
        : startedAtMs + s.totalDurationSec * 1000;
    const firstQid = questionOrder[0] ?? null;

    set({
      attemptId: s.attemptId,
      testId: s.testId,
      seriesId: s.seriesId,
      expiresAtMs,
      totalDurationSec: s.totalDurationSec,
      mode: s.mode === "ADAPTIVE" ? "ADAPTIVE" : "STANDARD",
      adaptive: s.adaptive ?? null,
      sections: s.sections,
      questionsById,
      questionOrder,
      currentQuestionId: firstQid,
      answers,
      questionTime: firstQid
        ? {
            ...questionTime,
            [firstQid]: { totalMs: questionTime[firstQid]?.totalMs ?? 0, enteredAtMs: Date.now() },
          }
        : questionTime,
      // ON_BREAK is a live state handled by the player overlay, not the store;
      // treat it as in-progress here (the next module re-hydrates on resume).
      status:
        s.status === "IN_PROGRESS" || s.status === "ON_BREAK"
          ? "IN_PROGRESS"
          : s.status,
    });
  },

  setCurrentQuestion: (questionId) => {
    const flushed = flushCurrentTimer(get());
    set({
      ...flushed,
      currentQuestionId: questionId,
      answers: {
        ...flushed.answers,
        [questionId]: flushed.answers[questionId] ?? {
          answer: null,
          markedForReview: false,
          visited: true,
        },
      },
      questionTime: {
        ...flushed.questionTime,
        [questionId]: {
          totalMs: flushed.questionTime[questionId]?.totalMs ?? 0,
          enteredAtMs: Date.now(),
        },
      },
    });
  },

  setAnswer: (questionId, answer) => {
    const state = get();
    const existing = state.answers[questionId] ?? {
      answer: null,
      markedForReview: false,
      visited: true,
    };
    set({
      answers: {
        ...state.answers,
        [questionId]: { ...existing, answer, visited: true },
      },
    });
  },

  toggleMarkForReview: (questionId) => {
    const state = get();
    const existing = state.answers[questionId] ?? {
      answer: null,
      markedForReview: false,
      visited: true,
    };
    set({
      answers: {
        ...state.answers,
        [questionId]: { ...existing, markedForReview: !existing.markedForReview },
      },
    });
  },

  clearAnswer: (questionId) => {
    const state = get();
    const existing = state.answers[questionId];
    if (!existing) return;
    set({
      answers: {
        ...state.answers,
        [questionId]: { ...existing, answer: null },
      },
    });
  },

  submitFinalize: (status) => {
    const flushed = flushCurrentTimer(get());
    set({ ...flushed, status });
  },

  reset: () => set(INITIAL),

  getQuestionTimeSec: (questionId) => {
    const entry = get().questionTime[questionId];
    if (!entry) return 0;
    const live = entry.enteredAtMs !== null ? Date.now() - entry.enteredAtMs : 0;
    return Math.floor((entry.totalMs + live) / 1000);
  },
}));
