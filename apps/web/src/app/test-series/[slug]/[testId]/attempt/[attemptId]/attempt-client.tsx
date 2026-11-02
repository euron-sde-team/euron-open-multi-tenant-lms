"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  useToast,
} from "@open-mtlms/core";
import {
  AlertTriangle,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  AlertCircle as CircleAlert,
  CircleDot,
  Clock,
  FileText,
  Flag,
  Hash,
  Calculator,
  Keyboard,
  ListChecks,
  Loader2,
  MapPin,
  Maximize2,
  Menu,
  Minimize2,
  MoreVertical,
  Pencil,
  Sigma,
  Timer,
  BookOpen,
  StickyNote,
  X,
} from "lucide-react";
import type { ThemeConfig } from "@open-mtlms/shared";
import { DragDropQuestion } from "@open-mtlms/lms-templates";

import { MathText } from "@/components/test-attempt/MathText";
import { FormulaSheet } from "@/components/test-attempt/FormulaSheet";
import { ScientificCalculator } from "@/components/test-attempt/ScientificCalculator";
import { GraphingCalculator } from "@/components/test-attempt/GraphingCalculator";
import { HighlightablePassage } from "@/components/test-attempt/HighlightablePassage";
import { ModuleIntermission } from "@/components/test-series/ModuleIntermission";
import { SectionBreak } from "@/components/test-series/SectionBreak";
import { useAnnotations } from "@/lib/hooks/use-annotations";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { useTestAttempt, useSubmitTestAttempt } from "@/lib/hooks/use-test-series";
import { useTestAutosave } from "@/lib/hooks/use-test-autosave";
import { useProctoring } from "@/lib/hooks/use-proctoring";
import { useTestAttemptStore } from "@/lib/stores/test-attempt-store";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";
import { testSeriesClientApi, type AttemptQuestion } from "@/lib/api/test-series";

interface Props {
  slug: string;
  testId: string;
  attemptId: string;
  theme?: ThemeConfig;
}

// ------------- Helpers -------------
function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

// Per-section directions (Bluebook parity). Reading/Writing and Math each get
// their own; used as a fallback when a section has no authored `instructions`.
const MATH_DIRECTIONS =
  "The questions in this section address a number of important math skills.\n\nUse of a calculator is permitted for all questions. A reference sheet, calculator, and these directions can be accessed throughout the test.\n\nUnless otherwise indicated:\n- All variables and expressions represent real numbers.\n- Figures provided are drawn to scale.\n- All figures lie in a plane.\n- The domain of a given function f is the set of all real numbers x for which f(x) is a real number.\n\nFor **multiple-choice questions**, solve each problem and choose the correct answer from the choices provided. Each multiple-choice question has a single correct answer.\n\nFor **student-produced response questions**, solve each problem and enter your answer:\n- If you find more than one correct answer, enter only one answer.\n- You can enter up to 5 characters for a positive answer and up to 6 characters (including the negative sign) for a negative answer.\n- If your answer is a fraction that doesn't fit in the provided space, enter the decimal equivalent.\n- If your answer is a decimal that doesn't fit, truncate or round at the fourth digit.\n- If your answer is a mixed number (such as 3½), enter it as an improper fraction (7/2) or its decimal equivalent (3.5).";
const READING_DIRECTIONS =
  "The questions in this section address a number of important reading and writing skills.\n\nEach question includes one or more passages, which may include a table or graph. Read each passage and question carefully, and then choose the best answer to the question based on the passage(s).\n\nAll questions in this section are **multiple-choice** with a single best answer.";

function defaultDirectionsFor(sectionName: string | null | undefined): string {
  const n = (sectionName ?? "").toLowerCase();
  if (n.includes("math")) return MATH_DIRECTIONS;
  return READING_DIRECTIONS;
}

// Stem JSON shape today: either a plain string (legacy) OR
// `{ text: string; imageUrl?: string; imageSize?: 'sm'|'md'|'lg'|'xl'; html?: string }`
// (current). Helpers tolerate both so old questions render unchanged.
type DiagramSize = "sm" | "md" | "lg" | "xl";

// Size class = max-height + max-width together. Without a width cap, any
// large image (e.g. 1920×1080) sprawls across the row regardless of the
// max-height. Both bounds + object-contain keep aspect ratio intact.
const STEM_SIZE_CLASS: Record<DiagramSize, string> = {
  sm: "max-h-48 max-w-xs",
  md: "max-h-80 max-w-md",
  lg: "max-h-[28rem] max-w-xl",
  xl: "max-h-[40rem] max-w-2xl",
};
const OPTION_SIZE_CLASS: Record<DiagramSize, string> = {
  sm: "max-h-24 max-w-[10rem]",
  md: "max-h-48 max-w-xs",
  lg: "max-h-72 max-w-sm",
  xl: "max-h-96 max-w-md",
};

function coerceSize(value: unknown): DiagramSize {
  return value === "sm" || value === "md" || value === "lg" || value === "xl"
    ? value
    : "md";
}

function getStemImageUrl(stem: unknown): string | null {
  if (typeof stem === "object" && stem !== null) {
    const o = stem as Record<string, unknown>;
    if (typeof o.imageUrl === "string" && o.imageUrl.length > 0) return o.imageUrl;
  }
  return null;
}

function getStemImageSize(stem: unknown): DiagramSize {
  if (typeof stem === "object" && stem !== null) {
    return coerceSize((stem as Record<string, unknown>).imageSize);
  }
  return "md";
}

// Plain-text stem (used by DRAG_DROP, which needs a string to locate the
// "___" blank). Tolerates both legacy `string` stems and the current
// `{ text, html, ... }` JSON shape.
function getStemText(stem: unknown): string {
  if (typeof stem === "string") return stem;
  if (typeof stem === "object" && stem !== null) {
    const o = stem as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
  }
  return "";
}

/** Optional long context/passage for the Description panel (stem JSON field). */
function getStemDescription(stem: unknown): string {
  if (typeof stem === "object" && stem !== null) {
    const o = stem as Record<string, unknown>;
    for (const key of ["description", "context", "passage"]) {
      const v = o[key];
      if (typeof v === "string" && v.trim().length > 0) return v.trim();
    }
  }
  return "";
}

function renderStem(stem: unknown): React.ReactNode {
  const imageUrl = getStemImageUrl(stem);
  const imageSize = getStemImageSize(stem);
  let textNode: React.ReactNode = null;
  if (stem === null || stem === undefined) {
    textNode = null;
  } else if (typeof stem === "string") {
    textNode = <MathText>{stem}</MathText>;
  } else if (typeof stem === "object") {
    const obj = stem as Record<string, unknown>;
    if (typeof obj.html === "string") {
      textNode = <div dangerouslySetInnerHTML={{ __html: obj.html }} />;
    } else if (typeof obj.text === "string") {
      textNode = <MathText>{obj.text}</MathText>;
    } else if (!imageUrl) {
      // Unrecognized shape AND no diagram to fall back on, dump JSON so the
      // student isn't staring at a blank question.
      textNode = <pre className="text-xs">{JSON.stringify(stem, null, 2)}</pre>;
    }
  }
  return (
    <>
      {textNode}
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Question diagram"
          className={`mt-3 block h-auto w-auto ${STEM_SIZE_CLASS[imageSize]} rounded border border-border object-contain`}
        />
      )}
    </>
  );
}

// DRAG_DROP renders the stem text (with its inline blank) itself, so the
// outer card only needs the optional diagram. Returns null when there's none.
function renderStemImageOnly(stem: unknown): React.ReactNode {
  const imageUrl = getStemImageUrl(stem);
  if (!imageUrl) return null;
  const imageSize = getStemImageSize(stem);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt="Question diagram"
      className={`block h-auto w-auto ${STEM_SIZE_CLASS[imageSize]} rounded border border-border object-contain`}
    />
  );
}

function getOptionsArray(
  options: unknown,
): Array<{ id: string; label: string; imageUrl: string | null; imageSize: DiagramSize }> {
  if (!Array.isArray(options)) return [];
  return options.map((opt, idx) => {
    if (typeof opt === "string") {
      return { id: String(idx), label: opt, imageUrl: null, imageSize: "md" };
    }
    if (typeof opt === "object" && opt !== null) {
      const o = opt as Record<string, unknown>;
      const id = (o.id as string | undefined) ?? String(idx);
      const label =
        (o.label as string | undefined) ??
        (o.text as string | undefined) ??
        (o.value as string | undefined) ??
        String(idx);
      const imageUrl =
        typeof o.imageUrl === "string" && o.imageUrl.length > 0
          ? o.imageUrl
          : null;
      return { id, label, imageUrl, imageSize: coerceSize(o.imageSize) };
    }
    return { id: String(idx), label: String(opt), imageUrl: null, imageSize: "md" };
  });
}

// ------------- Palette state -------------
type PaletteState = "not_visited" | "visited" | "answered" | "marked" | "marked_answered";

function getPaletteState(
  questionId: string,
  answers: ReturnType<typeof useTestAttemptStore.getState>["answers"]
): PaletteState {
  const a = answers[questionId];
  if (!a) return "not_visited";
  const hasAnswer = a.answer !== null && a.answer !== undefined && a.answer !== "" &&
    !(Array.isArray(a.answer) &&
      a.answer.filter((x) => x !== null && x !== undefined && x !== "").length === 0);
  if (a.markedForReview && hasAnswer) return "marked_answered";
  if (a.markedForReview) return "marked";
  if (hasAnswer) return "answered";
  return "visited";
}

// Bluebook navigator styling: answered = filled; unanswered = dashed outline;
// "for review" is shown with a flag overlay (see grid below), not a colour.
const PALETTE_CLASSES: Record<PaletteState, string> = {
  not_visited:
    "border border-dashed border-muted-foreground/50 bg-card text-foreground",
  visited:
    "border border-dashed border-muted-foreground/50 bg-card text-foreground",
  answered: "border border-primary bg-primary text-primary-foreground",
  marked:
    "border border-dashed border-muted-foreground/50 bg-card text-foreground",
  marked_answered: "border border-primary bg-primary text-primary-foreground",
};

// ------------- Components -------------
function QuestionView({
  question,
  answer,
  onChange,
  eliminated,
  onToggleEliminate,
  bluebook = false,
}: {
  question: AttemptQuestion;
  answer: unknown;
  onChange: (next: unknown) => void;
  eliminated?: Set<string>;
  onToggleEliminate?: (optionId: string) => void;
  bluebook?: boolean;
}) {
  const options = getOptionsArray(question.options);
  const elimProps = (optId: string) => ({
    bluebook,
    // With the eliminator off (Bluebook), previously-struck options stay
    // visibly crossed out but the strike buttons are hidden.
    eliminated: eliminated?.has(optId) ?? false,
    ...(onToggleEliminate
      ? { onEliminate: () => onToggleEliminate(optId) }
      : {}),
  });

  switch (question.type) {
    case "MCQ_SINGLE":
    case "TRUE_FALSE": {
      const selected = typeof answer === "string" ? answer : "";
      return (
        <div className="space-y-2.5">
          {options.map((opt, idx) => (
            <OptionCard
              key={opt.id}
              letter={String.fromCharCode(65 + idx)}
              label={opt.label}
              imageUrl={opt.imageUrl}
              imageSize={opt.imageSize}
              shortcut={idx + 1}
              selected={selected === opt.id}
              kind="radio"
              onSelect={() => onChange(opt.id)}
              {...elimProps(opt.id)}
            />
          ))}
        </div>
      );
    }
    case "MCQ_MULTI": {
      const selected = Array.isArray(answer) ? (answer as string[]) : [];
      const toggle = (id: string) => {
        const next = selected.includes(id)
          ? selected.filter((s) => s !== id)
          : [...selected, id];
        onChange(next);
      };
      return (
        <div className="space-y-2.5">
          <p className="text-muted-foreground text-xs">Select all that apply.</p>
          {options.map((opt, idx) => (
            <OptionCard
              key={opt.id}
              letter={String.fromCharCode(65 + idx)}
              label={opt.label}
              imageUrl={opt.imageUrl}
              imageSize={opt.imageSize}
              shortcut={idx + 1}
              selected={selected.includes(opt.id)}
              kind="checkbox"
              onSelect={() => toggle(opt.id)}
              {...elimProps(opt.id)}
            />
          ))}
        </div>
      );
    }
    case "FIB": {
      const value = typeof answer === "string" ? answer : "";
      return (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Type your answer below. Capitalisation is ignored.
          </p>
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Your answer"
              className={cn(
                "border-border bg-background w-full rounded-lg border-2 px-4 py-3 text-base font-medium",
                "placeholder:text-muted-foreground/60 placeholder:font-normal",
                "focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15",
                "transition-all duration-150",
              )}
            />
            <Pencil
              className="text-muted-foreground/40 pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
          </div>
        </div>
      );
    }
    case "NAT": {
      // Digital-SAT student-produced response (grid-in): a free type-in that
      // accepts an integer, decimal, or fraction. Stored as a string so the
      // backend can grade equivalent forms (3/5 = 0.6) per SAT rules.
      const value = answer === null || answer === undefined ? "" : String(answer);
      return (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Enter your answer, an integer, decimal, or fraction (e.g.{" "}
            <span className="font-mono">3/5</span>).
          </p>
          <div className="relative max-w-xs">
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              value={value}
              onChange={(e) => {
                // SAT answer grid: digits, one leading '-', '.' and '/', ≤6 chars.
                const v = e.target.value
                  .replace(/[^0-9./-]/g, "")
                  .slice(0, 6);
                onChange(v === "" ? null : v);
              }}
              placeholder="e.g. 7, 3/5, 0.6"
              className={cn(
                "border-border bg-background w-full rounded-lg border-2 px-4 py-3 font-mono text-lg font-semibold tabular-nums",
                "placeholder:text-muted-foreground/40",
                "focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15",
                "transition-all duration-150",
              )}
            />
            <Hash
              className="text-muted-foreground/40 pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
          </div>
          <p className="text-muted-foreground/70 text-[11px]">
            Fractions and decimals that equal the answer are both accepted. No
            mixed numbers, enter 5/4, not 1 1/4.
          </p>
        </div>
      );
    }
    case "DRAG_DROP": {
      // Answer is one option id per blank: a plain string for a single blank
      // (legacy) or an array (multi-blank). The renderer normalizes both.
      const dndValue =
        Array.isArray(answer) || typeof answer === "string"
          ? (answer as string | string[])
          : null;
      return (
        <DragDropQuestion
          questionText={getStemText(question.stem)}
          options={options.map((o) => ({ id: o.id, text: o.label }))}
          value={dndValue}
          onChange={(next) => onChange(next)}
        />
      );
    }
    case "DESCRIPTIVE": {
      // Free-text answer, later marked out of the question's total marks by a
      // human evaluator. Stored as a plain string (the textarea value); the
      // evaluator side reads both a plain string and `{ text }`. A blank answer
      // is allowed, the student may skip. The saved value re-seeds the textarea
      // on revisit; legacy `{ text }` answers are tolerated when reading.
      const value =
        typeof answer === "string"
          ? answer
          : typeof answer === "object" &&
              answer !== null &&
              typeof (answer as Record<string, unknown>).text === "string"
            ? ((answer as Record<string, unknown>).text as string)
            : "";
      return (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Write your answer below. It will be reviewed and marked by an
            evaluator.
          </p>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your answer here…"
            rows={12}
            className={cn(
              "border-border bg-background min-h-[16rem] w-full resize-y rounded-lg border-2 px-4 py-3 text-base leading-relaxed",
              "placeholder:text-muted-foreground/60",
              "focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15",
              "transition-all duration-150",
            )}
          />
        </div>
      );
    }
    default:
      return (
        <p className="text-destructive text-sm">
          Unsupported question type: {question.type}
        </p>
      );
  }
}

function OptionCard({
  letter,
  label,
  imageUrl,
  imageSize = "md",
  shortcut,
  selected,
  kind,
  onSelect,
  eliminated = false,
  onEliminate,
  bluebook = false,
}: {
  letter: string;
  label: string;
  imageUrl?: string | null;
  imageSize?: DiagramSize;
  shortcut: number;
  selected: boolean;
  kind: "radio" | "checkbox";
  onSelect: () => void;
  eliminated?: boolean;
  onEliminate?: () => void;
  bluebook?: boolean;
}) {
  return (
    <div className="relative">
    <button
      type="button"
      onClick={() => {
        if (eliminated) onEliminate?.(); // selecting un-eliminates
        onSelect();
      }}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all duration-200",
        "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        eliminated && "opacity-45",
        selected
          ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20"
          : "border-border hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-md",
        bluebook && "rounded-lg",
        bluebook && selected && "ring-2 ring-primary bg-card shadow-none",
      )}
      aria-pressed={selected}
      role={kind === "radio" ? "radio" : "checkbox"}
      aria-checked={selected}
    >
      <span
        className={cn(
          "relative flex h-8 w-8 shrink-0 items-center justify-center text-sm font-semibold transition-all duration-200",
          kind === "radio" ? "rounded-full" : "rounded-md",
          bluebook
            ? // Bluebook: bordered letter circle that keeps its letter; fills
              // blue when the choice is selected.
              selected
                ? "border-primary bg-primary text-primary-foreground border-2"
                : "border-foreground/50 text-foreground border-2 bg-transparent"
            : selected
              ? "bg-primary text-primary-foreground scale-105 shadow-sm"
              : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/15",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "transition-opacity duration-150",
            selected && !bluebook ? "opacity-0" : "opacity-100",
          )}
        >
          {letter}
        </span>
        {!bluebook && (
          <Check
            className={cn(
              "absolute h-4 w-4 transition-all duration-200",
              selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
            )}
            strokeWidth={3}
          />
        )}
      </span>
      <span
        className={cn(
          "text-foreground min-w-0 flex-1 space-y-2 text-base leading-relaxed",
          eliminated && "line-through",
        )}
      >
        {label && <MathText block={false}>{label}</MathText>}
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`Option ${letter} diagram`}
            className={`block h-auto w-auto ${OPTION_SIZE_CLASS[imageSize]} rounded border border-border object-contain`}
          />
        )}
      </span>
      {!bluebook && (
        <kbd
          className={cn(
            "border-border text-muted-foreground mr-7 hidden shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline-flex",
            selected && "border-primary/30 bg-primary/10 text-primary",
          )}
          aria-hidden
        >
          {shortcut}
        </kbd>
      )}
    </button>
      {onEliminate &&
        (bluebook && eliminated ? (
          /* Bluebook: a struck-out option shows an "Undo" affordance. */
          <button
            type="button"
            onClick={onEliminate}
            className="text-foreground absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold underline underline-offset-2"
          >
            Undo
          </button>
        ) : (
          <button
            type="button"
            onClick={onEliminate}
            title={eliminated ? "Undo eliminate" : "Eliminate this choice"}
            aria-label={eliminated ? "Undo eliminate" : "Eliminate this choice"}
            className={cn(
              "border-border text-muted-foreground hover:text-foreground hover:bg-muted absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border text-[10px] font-bold transition-colors",
              eliminated && "border-destructive/40 text-destructive",
              bluebook && "border-foreground/60 text-foreground",
            )}
          >
            <span className={cn((eliminated || bluebook) && "line-through")}>
              {letter}
            </span>
          </button>
        ))}
    </div>
  );
}

// ------------- Main client -------------
export function AttemptClient({ slug, testId, attemptId, theme }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const { data: state, isLoading, error } = useTestAttempt(attemptId);
  const submitMutation = useSubmitTestAttempt();

  const store = useTestAttemptStore();
  const {
    sections,
    questionsById,
    currentQuestionId,
    answers,
    expiresAtMs,
    status,
    mode,
    adaptive,
    setCurrentQuestion,
    setAnswer,
    toggleMarkForReview,
    clearAnswer,
    submitFinalize,
    getQuestionTimeSec,
    hydrate,
  } = store;
  const isAdaptive = mode === "ADAPTIVE";
  const calcMode = String(state?.test?.calculatorMode ?? "NONE").toUpperCase();
  const calcEnabled = calcMode === "SCIENTIFIC" || calcMode === "GRAPHING";
  const isLastModule =
    isAdaptive && adaptive !== null && adaptive.moduleOrdinal >= adaptive.totalModules;
  // Exact College Board Bluebook chrome for adaptive (Digital SAT) attempts:
  // centered hideable timer, Mark-for-Review in the question strip, ABC
  // eliminator toggle, "Question X of Y" navigator popup, Check Your Work page.
  // Linear tests keep the generic player.
  const bluebook = isAdaptive;
  const studentName = useUserAuthStore((s) => s.member?.name ?? "");

  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [moduleSubmitting, setModuleSubmitting] = useState(false);
  const [intermission, setIntermission] = useState<{ finishedOrdinal: number } | null>(
    null
  );
  // Inter-section break (adaptive). When set, a full-screen break overlay shows
  // a server-authoritative 10-min countdown; the next section is PENDING until
  // the learner resumes (early or on timer expiry).
  const [breakInfo, setBreakInfo] = useState<{
    breakEndsAt: string | null;
    nextSectionName: string;
  } | null>(null);
  const [resumingBreak, setResumingBreak] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Bluebook chrome state: hideable timer + one-time 5-minute alert, ABC
  // answer-eliminator mode, footer "Question X of Y" navigator popup, More
  // menu, and the end-of-module "Check Your Work" review page.
  const [timerHidden, setTimerHidden] = useState(false);
  const [fiveMinAlert, setFiveMinAlert] = useState(false);
  const fiveMinNotifiedRef = useRef(false);
  const [elimMode, setElimMode] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Docked calculator enlarge (Bluebook: big, but never the whole screen),
  // Graphing|Scientific tab, and reference-sheet enlarge.
  const [calcExpanded, setCalcExpanded] = useState(false);
  const [calcTab, setCalcTab] = useState<"GRAPHING" | "SCIENTIFIC">("GRAPHING");
  const [refExpanded, setRefExpanded] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  // Bluebook-style draggable split between passage (left) and question (right).
  const [splitPct, setSplitPct] = useState(50);
  const [isWideScreen, setIsWideScreen] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsWideScreen(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const startSplitDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const rect = splitRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(72, Math.max(28, pct)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);
  // Free per-question scratch notes (in-memory for the session).
  const [scratchNotes, setScratchNotes] = useState<Record<string, string>>({});
  // Passage highlight / underline / notes (per-question, in-memory).
  const annotations = useAnnotations();
  // Per-question eliminated answer choices (local, UI-only, not graded/saved).
  const [eliminated, setEliminated] = useState<Record<string, Set<string>>>({});
  const toggleEliminate = useCallback((qid: string, optId: string) => {
    setEliminated((prev) => {
      const set = new Set(prev[qid] ?? []);
      if (set.has(optId)) set.delete(optId);
      else set.add(optId);
      return { ...prev, [qid]: set };
    });
  }, []);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(0);
  // Drives the time-on-current-question chip; ticks every second.
  const [questionTickSec, setQuestionTickSec] = useState(0);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const hydratedRef = useRef(false);
  const submittingRef = useRef(false);

  // ---- Hydrate Zustand store from React Query data ----
  useEffect(() => {
    if (!state || hydratedRef.current) return;
    if (state.status === "ON_BREAK") {
      // Refreshed/landed during a break, show the break overlay; the next
      // module hydrates on resume.
      setBreakInfo({
        breakEndsAt: state.breakEndsAt ?? null,
        nextSectionName: state.adaptive?.sectionName ?? "",
      });
      hydratedRef.current = true;
      return;
    }
    hydrate(state);
    setActiveSectionId(state.sections[0]?.id ?? null);
    hydratedRef.current = true;
  }, [state, hydrate]);

  // ---- Blank-proof: keep the active question valid ----
  // After an adaptive module advance the served set changes; if the current
  // question id is ever stale (not in the new module's questions), the panel
  // would render blank. Snap to the first served question so a question is
  // always shown.
  useEffect(() => {
    if (status !== "IN_PROGRESS") return;
    const ids = sections.flatMap((s) => s.questionIds);
    if (ids.length === 0) return;
    if (!currentQuestionId || !questionsById[currentQuestionId]) {
      setCurrentQuestion(ids[0]);
    }
  }, [sections, questionsById, currentQuestionId, status, setCurrentQuestion]);

  // ---- Timer ----
  useEffect(() => {
    if (!expiresAtMs || status !== "IN_PROGRESS" || breakInfo) return;
    const tick = () => {
      // Ceil so a freshly served 32-min module reads 32:00 (not 31:59 after
      // network latency), clamped to the module duration so server grace or
      // client clock skew can never display MORE than the module's time
      // (the "32:05" bug).
      const raw = Math.ceil((expiresAtMs - Date.now()) / 1000);
      const cap = useTestAttemptStore.getState().totalDurationSec;
      const remaining = Math.max(0, cap > 0 ? Math.min(raw, cap) : raw);
      setTimeLeftSec(remaining);
      if (remaining === 0) {
        // Auto-submit: adaptive attempts submit the MODULE (the server routes
        // and serves the next one); standard attempts submit the whole test.
        if (useTestAttemptStore.getState().mode === "ADAPTIVE") {
          void handleModuleSubmit(true);
        } else {
          void handleSubmit(true);
        }
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAtMs, status, breakInfo]);

  // Bluebook: at 5 minutes remaining the timer un-hides itself, turns red and
  // a one-time alert is shown; it can no longer be hidden for the module.
  useEffect(() => {
    if (!bluebook) return;
    if (timeLeftSec > 0 && timeLeftSec <= 300 && !fiveMinNotifiedRef.current) {
      fiveMinNotifiedRef.current = true;
      setTimerHidden(false);
      setFiveMinAlert(true);
    }
  }, [bluebook, timeLeftSec]);

  // Reset per-module Bluebook chrome when the adaptive engine advances.
  const attemptModuleKey = adaptive?.attemptModuleId ?? null;
  useEffect(() => {
    fiveMinNotifiedRef.current = false;
    setReviewOpen(false);
    setNavOpen(false);
    setElimMode(false);
    setTimerHidden(false);
  }, [attemptModuleKey]);

  // Tests configured for a scientific-only calculator open on that tab.
  useEffect(() => {
    if (calcMode === "SCIENTIFIC") setCalcTab("SCIENTIFIC");
  }, [calcMode]);

  // ---- Autosave ----
  const { queue: queueAutosave, flushNow } = useTestAutosave({
    attemptId,
    onFlush: () => setAutosaveStatus("saved"),
    // Stale patch (the module already advanced): benign, the queued answer is
    // dropped server-side anyway. Don't alarm the learner; the active module's
    // answers are unaffected.
    onStale: () => setAutosaveStatus("saved"),
    onError: (err) => {
      setAutosaveStatus("error");
      const status =
        (err as { status?: number })?.status ??
        (err as { response?: { status?: number } })?.response?.status;
      const msg = err instanceof Error ? err.message : "Unknown error";
      let description = "We'll keep retrying. Don't refresh.";
      if (status === 401 || status === 403) {
        description = "Your session expired. Please log in again in another tab to keep saving.";
      } else if (status === 500) {
        description = `Server error: ${msg}`;
      } else if (!status) {
        description = `Network error: ${msg}`;
      } else {
        description = `${status}: ${msg}`;
      }
      toast({
        title: "Couldn't save your answer",
        description,
        variant: "destructive",
      });
    },
  });

  const queueAnswerSave = useCallback(
    (qid: string) => {
      const a = useTestAttemptStore.getState().answers[qid];
      const time = useTestAttemptStore.getState().getQuestionTimeSec(qid);
      setAutosaveStatus("saving");
      queueAutosave({
        question_id: qid,
        answer: a?.answer ?? null,
        marked_for_review: a?.markedForReview ?? false,
        time_spent_sec: time,
      });
    },
    [queueAutosave]
  );

  // ---- Sections + questions ----

  const currentQuestion = currentQuestionId
    ? questionsById[currentQuestionId] ?? null
    : null;

  // Active section + its directions (authored `instructions` or a Bluebook default).
  const currentSection =
    sections.find((s) => s.id === activeSectionId) ?? sections[0] ?? null;
  const currentDirections =
    currentSection?.instructions && currentSection.instructions.trim().length > 0
      ? currentSection.instructions
      : defaultDirectionsFor(currentSection?.name);
  const currentNotes = currentQuestion
    ? annotations.getNotesForQuestion(currentQuestion.id)
    : [];
  // Bluebook shows Reference + Calculator only during Math.
  const isMathSection = /math/i.test(currentSection?.name ?? "");

  // Track question position within active section for prev/next
  const flatQuestionList = useMemo(() => {
    return sections.flatMap((s) => s.questionIds.map((qid) => ({ qid, sectionId: s.id })));
  }, [sections]);

  const currentIndex = useMemo(() => {
    if (!currentQuestionId) return -1;
    return flatQuestionList.findIndex((q) => q.qid === currentQuestionId);
  }, [flatQuestionList, currentQuestionId]);

  const goNext = useCallback(() => {
    if (!currentQuestionId) return;
    queueAnswerSave(currentQuestionId);
    if (currentIndex < flatQuestionList.length - 1) {
      const next = flatQuestionList[currentIndex + 1];
      setCurrentQuestion(next.qid);
      setActiveSectionId(next.sectionId);
    }
  }, [currentIndex, flatQuestionList, currentQuestionId, setCurrentQuestion, queueAnswerSave]);

  const goPrev = useCallback(() => {
    if (!currentQuestionId || currentIndex <= 0) return;
    queueAnswerSave(currentQuestionId);
    const prev = flatQuestionList[currentIndex - 1];
    setCurrentQuestion(prev.qid);
    setActiveSectionId(prev.sectionId);
  }, [currentIndex, flatQuestionList, currentQuestionId, setCurrentQuestion, queueAnswerSave]);

  const handleSaveAndNext = goNext;

  // Bluebook header/footer label: "Section 1, Module 2: Reading and Writing".
  const bluebookModuleLabel = useMemo(() => {
    if (!adaptive) return state?.test?.name ?? "";
    const sn = adaptive.sectionName ?? "";
    const secNum = /read|writ/i.test(sn) ? 1 : /math/i.test(sn) ? 2 : null;
    const mod = adaptive.moduleNumberInSection ?? adaptive.moduleOrdinal;
    return `${secNum ? `Section ${secNum}, ` : ""}Module ${mod}${sn ? `: ${sn}` : ""}`;
  }, [adaptive, state?.test?.name]);

  // Bluebook footer "Next": advance, or open Check Your Work after the last
  // question of the module.
  const handleBluebookNext = useCallback(() => {
    if (currentIndex >= flatQuestionList.length - 1) {
      if (currentQuestionId) queueAnswerSave(currentQuestionId);
      setNavOpen(false);
      setReviewOpen(true);
    } else {
      goNext();
    }
  }, [currentIndex, flatQuestionList.length, currentQuestionId, queueAnswerSave, goNext]);

  const handleToggleMark = useCallback(() => {
    if (!currentQuestionId) return;
    toggleMarkForReview(currentQuestionId);
    queueAnswerSave(currentQuestionId);
  }, [currentQuestionId, toggleMarkForReview, queueAnswerSave]);

  const handleClear = useCallback(() => {
    if (!currentQuestionId) return;
    clearAnswer(currentQuestionId);
    queueAnswerSave(currentQuestionId);
  }, [currentQuestionId, clearAnswer, queueAnswerSave]);

  const handleAnswerChange = useCallback(
    (next: unknown) => {
      if (!currentQuestionId) return;
      setAnswer(currentQuestionId, next);
      // Live autosave (debounced)
      queueAnswerSave(currentQuestionId);
    },
    [currentQuestionId, setAnswer, queueAnswerSave]
  );

  // Tick every second so the time-on-current-question chip updates smoothly.
  useEffect(() => {
    if (!currentQuestionId) return;
    const tick = () =>
      setQuestionTickSec(getQuestionTimeSec(currentQuestionId));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [currentQuestionId, getQuestionTimeSec]);

  // Press "?" anywhere to toggle the keyboard shortcuts overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      } else if (e.key === "Escape") {
        setShowShortcuts(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keyboard shortcuts: 1-9 selects option N for the current MCQ. Skip when
  // the user is typing inside an input/textarea/contenteditable.
  useEffect(() => {
    if (!currentQuestion) return;
    if (
      currentQuestion.type !== "MCQ_SINGLE" &&
      currentQuestion.type !== "MCQ_MULTI" &&
      currentQuestion.type !== "TRUE_FALSE"
    )
      return;
    const opts = getOptionsArray(currentQuestion.options);
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > opts.length) return;
      e.preventDefault();
      const opt = opts[n - 1];
      if (currentQuestion.type === "MCQ_MULTI") {
        const current =
          (answers[currentQuestion.id]?.answer as string[] | undefined) ?? [];
        const next = current.includes(opt.id)
          ? current.filter((s) => s !== opt.id)
          : [...current, opt.id];
        handleAnswerChange(next);
      } else {
        handleAnswerChange(opt.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentQuestion, answers, handleAnswerChange]);

  const jumpToQuestion = useCallback(
    (qid: string, sectionId: string) => {
      if (currentQuestionId) queueAnswerSave(currentQuestionId);
      setCurrentQuestion(qid);
      setActiveSectionId(sectionId);
      setPaletteOpen(false);
    },
    [currentQuestionId, setCurrentQuestion, queueAnswerSave]
  );

  // ---- Submit ----
  const handleSubmit = useCallback(
    async (auto: boolean = false) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      try {
        if (currentQuestionId) queueAnswerSave(currentQuestionId);
        await flushNow();
        const result = await submitMutation.mutateAsync({ attemptId });
        submitFinalize(auto ? "AUTO_SUBMITTED" : "SUBMITTED");
        toast({
          title: auto ? "Time's up, submitted" : "Submitted",
          description: `Score: ${result.score}/${result.totalMarks}`,
        });
        router.push(`/test-series/${slug}/${testId}/result/${attemptId}`);
      } catch (err) {
        submittingRef.current = false;
        toast({
          title: "Submit failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [
      attemptId,
      currentQuestionId,
      queueAnswerSave,
      flushNow,
      submitMutation,
      submitFinalize,
      toast,
      router,
      slug,
      testId,
    ]
  );

  // ---- Adaptive module submit ----
  const handleModuleSubmit = useCallback(
    async (auto: boolean = false) => {
      const liveAdaptive = useTestAttemptStore.getState().adaptive;
      const attemptModuleId = liveAdaptive?.attemptModuleId;
      if (!attemptModuleId) {
        void handleSubmit(auto);
        return;
      }
      if (submittingRef.current) return;
      submittingRef.current = true;
      setModuleSubmitting(true);
      try {
        if (currentQuestionId) queueAnswerSave(currentQuestionId);
        await flushNow();
        const finishedOrdinal = liveAdaptive?.moduleOrdinal ?? 1;
        const outcome = await testSeriesClientApi.submitModule(
          attemptId,
          attemptModuleId
        );
        if (outcome.outcome === "COMPLETED") {
          submitFinalize(auto ? "AUTO_SUBMITTED" : "SUBMITTED");
          const r = outcome.result;
          toast({
            title: auto ? "Time's up, submitted" : "Test submitted",
            description:
              r.scaledScore != null && r.scaledScoreMax != null
                ? `Scaled score: ${r.scaledScore}/${r.scaledScoreMax}`
                : `Score: ${r.score}/${r.totalMarks}`,
          });
          router.push(`/test-series/${slug}/${testId}/result/${attemptId}`);
          return;
        }
        if (outcome.outcome === "ON_BREAK") {
          // Section finished and a break is configured. Show the break overlay;
          // the next section stays PENDING until resume. Do NOT hydrate (the
          // next module is not active yet), the break clock is on the server.
          setBreakInfo({
            breakEndsAt: outcome.state.breakEndsAt ?? null,
            nextSectionName: outcome.state.adaptive?.sectionName ?? "",
          });
          submittingRef.current = false;
          return;
        }
        // NEXT_MODULE: the server clock for the next module is already
        // running, so hydrate immediately and show the interstitial on top.
        hydrate(outcome.state);
        setActiveSectionId(outcome.state.sections[0]?.id ?? null);
        setIntermission({ finishedOrdinal });
        submittingRef.current = false;
      } catch (err) {
        submittingRef.current = false;
        toast({
          title: "Module submit failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setModuleSubmitting(false);
      }
    },
    [
      attemptId,
      currentQuestionId,
      queueAnswerSave,
      flushNow,
      submitFinalize,
      hydrate,
      handleSubmit,
      toast,
      router,
      slug,
      testId,
    ]
  );

  // ---- Resume from inter-section break ----
  const handleResumeBreak = useCallback(async () => {
    if (resumingBreak) return;
    setResumingBreak(true);
    try {
      const next = await testSeriesClientApi.resumeBreak(attemptId);
      hydratedRef.current = true;
      hydrate(next);
      setActiveSectionId(next.sections[0]?.id ?? null);
      setBreakInfo(null);
    } catch (err) {
      toast({
        title: "Couldn't resume the test",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setResumingBreak(false);
    }
  }, [attemptId, hydrate, resumingBreak, toast]);

  // ---- Proctoring (client-side, lightweight) ----
  const proctoringActive =
    Boolean(state?.test?.proctoringEnabled) && status === "IN_PROGRESS";
  const {
    mediaError: proctorMediaError,
    requestFullscreen,
    retryMedia,
  } = useProctoring({
    attemptId,
    active: proctoringActive,
    config: {
      enabled: Boolean(state?.test?.proctoringEnabled),
      camera: Boolean(state?.test?.proctorCamera),
      mic: Boolean(state?.test?.proctorMic),
      fullscreen: Boolean(state?.test?.proctorFullscreen),
      blockCopyPaste: Boolean(state?.test?.proctorBlockCopyPaste),
      maxTabSwitches: state?.test?.proctorMaxTabSwitches ?? null,
      action: (state?.test?.proctorAction as "WARN" | "AUTO_SUBMIT") ?? "WARN",
      // Two warnings before enforcement, and flag external displays/projectors.
      maxWarnings: 2,
      blockExternalDisplay: true,
    },
    onWarn: (message) =>
      toast({ title: "Proctoring notice", description: message, variant: "destructive" }),
    onAutoSubmit: () => void handleSubmit(true),
  });


  // Enter fullscreen once when a fullscreen-proctored attempt goes live.
  const fsRequestedRef = useRef(false);
  useEffect(() => {
    if (
      proctoringActive &&
      state?.test?.proctorFullscreen &&
      !fsRequestedRef.current
    ) {
      fsRequestedRef.current = true;
      requestFullscreen();
    }
  }, [proctoringActive, state?.test?.proctorFullscreen, requestFullscreen]);

  // ---- Counts (for confirm modal) ----
  const counts = useMemo(() => {
    const total = flatQuestionList.length;
    let answered = 0;
    let marked = 0;
    let notVisited = 0;
    for (const { qid } of flatQuestionList) {
      const a = answers[qid];
      if (!a) {
        notVisited += 1;
        continue;
      }
      const has =
        a.answer !== null &&
        a.answer !== undefined &&
        a.answer !== "" &&
        !(Array.isArray(a.answer) && a.answer.length === 0);
      if (has) answered += 1;
      if (a.markedForReview) marked += 1;
    }
    return { total, answered, marked, notVisited };
  }, [flatQuestionList, answers]);

  // ---- Loading / error ----
  if (isLoading || !hydratedRef.current) {
    return (
      <TenantThemeProvider theme={theme}>
        <div className="bg-background flex min-h-screen items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      </TenantThemeProvider>
    );
  }

  if (error || !state) {
    return (
      <TenantThemeProvider theme={theme}>
        <div className="bg-background flex min-h-screen items-center justify-center px-4 text-center">
          <div>
            <AlertTriangle className="text-destructive mx-auto h-10 w-10" />
            <h1 className="text-foreground mt-4 text-xl font-bold">
              Could not load attempt
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {error instanceof Error ? error.message : "Please try again."}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push(`/test-series/${slug}/dashboard`)}
            >
              Back to series
            </Button>
          </div>
        </div>
      </TenantThemeProvider>
    );
  }

  // If already submitted, redirect to result. ON_BREAK is an active state, it
  // shows the break overlay below, not the result page.
  if (state.status !== "IN_PROGRESS" && state.status !== "ON_BREAK") {
    router.replace(`/test-series/${slug}/${testId}/result/${attemptId}`);
    return null;
  }

  // Inter-section break overlay (full screen, server-authoritative timer).
  if (breakInfo) {
    return (
      <TenantThemeProvider theme={theme}>
        <SectionBreak
          breakEndsAt={breakInfo.breakEndsAt}
          nextSectionName={breakInfo.nextSectionName}
          onResume={handleResumeBreak}
          resuming={resumingBreak}
        />
      </TenantThemeProvider>
    );
  }

  const timerWarning = timeLeftSec > 0 && timeLeftSec <= 300; // last 5 min
  const timerCritical = timeLeftSec === 0;

  return (
    <TenantThemeProvider theme={theme}>
      {/* Question fade-in keyframes used by the .animate-[questionFade_...] class */}
      <style>{`@keyframes questionFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div
        className="bg-background flex h-screen flex-col"
        style={
          // Bluebook is a plain white canvas; the generic player keeps the
          // subtle dot-grid texture (~24px spacing, very light dots).
          bluebook
            ? undefined
            : {
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, hsl(var(--foreground) / 0.06) 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }
        }
      >
        {/* Header */}
        {bluebook ? (
          /* Bluebook header: section title + Directions (left), hideable
             centered timer, tool buttons (right). No Submit button, the
             module is submitted from the Check Your Work page. */
          <header className="border-border bg-card relative z-30 shrink-0 border-b px-3 sm:px-6">
            <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="min-w-0">
                <h1 className="text-foreground truncate text-sm font-semibold sm:text-base">
                  {bluebookModuleLabel}
                </h1>
                <button
                  type="button"
                  onClick={() => setDirectionsOpen((v) => !v)}
                  className="text-muted-foreground hover:text-foreground mt-0.5 inline-flex items-center gap-1 text-xs font-medium"
                  aria-expanded={directionsOpen}
                  aria-label="Toggle section directions"
                >
                  Directions
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      directionsOpen && "rotate-180"
                    )}
                  />
                </button>
              </div>
              <div className="flex flex-col items-center justify-center">
                {timerHidden ? (
                  <button
                    type="button"
                    onClick={() => setTimerHidden(false)}
                    className="border-border text-foreground hover:bg-muted inline-flex items-center justify-center rounded-full border px-3 py-1.5"
                    aria-label="Show timer"
                    title="Show timer"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                ) : (
                  <>
                    <span
                      className={cn(
                        "font-mono text-lg font-bold leading-none tabular-nums sm:text-xl",
                        timerWarning && "text-red-600 dark:text-red-400",
                        timeLeftSec > 0 && timeLeftSec <= 60 && "animate-pulse"
                      )}
                      aria-live="polite"
                    >
                      {formatTime(timeLeftSec)}
                    </span>
                    {/* The timer can't be hidden in the last 5 minutes. */}
                    {!timerWarning && !timerCritical && (
                      <button
                        type="button"
                        onClick={() => setTimerHidden(true)}
                        className="border-border text-muted-foreground hover:text-foreground mt-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                      >
                        Hide
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-0.5 sm:gap-2">
                <AutosaveBadge status={autosaveStatus} />
                <HeaderTool
                  icon={StickyNote}
                  label="Highlights & Notes"
                  active={notesOpen}
                  onClick={() => setNotesOpen((v) => !v)}
                  badge={currentNotes.length > 0 ? currentNotes.length : undefined}
                />
                {isMathSection && (
                  <HeaderTool
                    icon={Sigma}
                    label="Reference"
                    active={formulaOpen}
                    onClick={() => setFormulaOpen((v) => !v)}
                  />
                )}
                {isMathSection && calcEnabled && (
                  <HeaderTool
                    icon={Calculator}
                    label="Calculator"
                    active={calcOpen}
                    onClick={() => setCalcOpen((v) => !v)}
                  />
                )}
                <div className="relative">
                  <HeaderTool
                    icon={MoreVertical}
                    label="More"
                    active={moreOpen}
                    onClick={() => setMoreOpen((v) => !v)}
                  />
                  {moreOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMoreOpen(false)}
                        role="presentation"
                      />
                      <div className="border-border bg-card absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border py-1 shadow-xl">
                        <MoreMenuItem
                          icon={FileText}
                          label="Description"
                          onClick={() => {
                            setMoreOpen(false);
                            setDescOpen(true);
                          }}
                        />
                        <MoreMenuItem
                          icon={Keyboard}
                          label="Shortcuts"
                          onClick={() => {
                            setMoreOpen(false);
                            setShowShortcuts(true);
                          }}
                        />
                        <MoreMenuItem
                          icon={ListChecks}
                          label={isLastModule ? "Finish Test" : "Submit Module"}
                          onClick={() => {
                            setMoreOpen(false);
                            setShowSubmitConfirm(true);
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* Directions dropdown, anchored under the header, Bluebook-style */}
            {directionsOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/20"
                  onClick={() => setDirectionsOpen(false)}
                  role="presentation"
                />
                <div className="border-border bg-card absolute left-0 top-full z-50 max-h-[60vh] w-full max-w-2xl overflow-y-auto rounded-b-lg border border-t-0 p-5 shadow-2xl">
                  <div className="text-sm leading-relaxed">
                    <MathText>{currentDirections}</MathText>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      size="sm"
                      className="rounded-full px-5"
                      onClick={() => setDirectionsOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </>
            )}
          </header>
        ) : (
        <header className="border-border bg-card relative flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3 sm:h-16 sm:px-6">
          <div className="flex items-center gap-3 truncate">
            <button
              onClick={() => setPaletteOpen(true)}
              className="text-foreground rounded-md p-1.5 hover:bg-muted lg:hidden"
              aria-label="Open palette"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-foreground truncate text-sm font-semibold sm:text-base">
              {state.test.name}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <AutosaveBadge status={autosaveStatus} />
            <span
              className="bg-muted text-muted-foreground hidden items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs tabular-nums sm:inline-flex"
              title="Questions answered"
            >
              <Check className="text-emerald-600 h-3 w-3 dark:text-emerald-400" />
              {counts.answered}/{counts.total}
            </span>
            <TimerPill
              seconds={timeLeftSec}
              warning={timerWarning}
              critical={timerCritical}
            />
            <button
              type="button"
              onClick={() => setDirectionsOpen((v) => !v)}
              className={cn(
                "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                directionsOpen && "bg-primary/10 text-primary"
              )}
              aria-label="Toggle section directions"
              title="Section directions"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Directions</span>
            </button>
            <button
              type="button"
              onClick={() => setNotesOpen((v) => !v)}
              className={cn(
                "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                notesOpen && "bg-primary/10 text-primary"
              )}
              aria-label="Toggle notes"
              title="Your notes for this question"
            >
              <StickyNote className="h-4 w-4" />
              <span className="hidden sm:inline">Notes</span>
              {currentNotes.length > 0 && (
                <span className="bg-primary text-primary-foreground ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold">
                  {currentNotes.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setDescOpen((v) => !v)}
              className={cn(
                "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                descOpen && "bg-primary/10 text-primary"
              )}
              aria-label="Toggle problem description"
              title="Problem description / context"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Description</span>
            </button>
            <button
              type="button"
              onClick={() => setFormulaOpen((v) => !v)}
              className={cn(
                "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                formulaOpen && "bg-primary/10 text-primary"
              )}
              aria-label="Toggle formula sheet"
              title="Reference formula sheet"
            >
              <Sigma className="h-4 w-4" />
              <span className="hidden sm:inline">Formulas</span>
            </button>
            {calcEnabled && (
              <button
                type="button"
                onClick={() => setCalcOpen((v) => !v)}
                className={cn(
                  "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-md p-1.5 transition-colors",
                  calcOpen && "bg-primary/10 text-primary"
                )}
                aria-label="Toggle calculator"
                title={calcMode === "GRAPHING" ? "Graphing calculator" : "Scientific calculator"}
              >
                <Calculator className="h-4 w-4" />
              </button>
            )}
            <Button
              size="sm"
              onClick={() => setShowSubmitConfirm(true)}
              disabled={submitMutation.isPending || moduleSubmitting}
            >
              {moduleSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Submit
            </Button>
          </div>

          {/* Live progress bar: % of questions answered across all sections */}
          <div
            className="bg-border/40 absolute bottom-0 left-0 right-0 h-[2px]"
            aria-hidden
          >
            <div
              className="bg-primary h-full transition-[width] duration-500 ease-out"
              style={{
                width:
                  counts.total > 0
                    ? `${(counts.answered / counts.total) * 100}%`
                    : "0%",
              }}
            />
          </div>
        </header>
        )}

        {/* Bluebook-style practice-test banner */}
        <div className="bg-[#1e1b4b] py-1 text-center text-[11px] font-bold uppercase tracking-wider text-white">
          This is a practice test
        </div>

        {/* Floating tools (generic player, and Bluebook on small screens where
            there's no room to dock). On wide Bluebook screens the calculator
            and reference sheet DOCK beside the question instead, the content
            reflows and nothing is covered. */}
        {calcOpen &&
          !(bluebook && isWideScreen) &&
          (calcMode === "GRAPHING" ? (
            <GraphingCalculator onClose={() => setCalcOpen(false)} />
          ) : (
            <ScientificCalculator onClose={() => setCalcOpen(false)} />
          ))}
        {formulaOpen && !(bluebook && isWideScreen) && (
          <FormulaSheet onClose={() => setFormulaOpen(false)} />
        )}
        {descOpen && (
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">Description</h2>
                <p className="text-muted-foreground text-xs">
                  Context for the current question.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDescOpen(false)}
                aria-label="Close description"
                className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed">
              {(() => {
                const desc = currentQuestion
                  ? getStemDescription(currentQuestion.stem)
                  : "";
                return desc ? (
                  <MathText>{desc}</MathText>
                ) : (
                  <p className="text-muted-foreground">
                    No additional description available for this question.
                  </p>
                );
              })()}
            </div>
          </div>
        )}

        {/* Section directions side panel (generic player only: Bluebook uses
            the dropdown anchored under the header instead) */}
        {directionsOpen && !bluebook && (
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">Directions</h2>
                <p className="text-muted-foreground text-xs">
                  {currentSection?.name ?? "This section"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDirectionsOpen(false)}
                aria-label="Close directions"
                className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed">
              <MathText>{currentDirections}</MathText>
            </div>
          </div>
        )}

        {/* Notes for the current question */}
        {notesOpen && (
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">Notes</h2>
                <p className="text-muted-foreground text-xs">
                  Private scratch notes for this question.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                aria-label="Close notes"
                className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {currentQuestion ? (
                <>
                  <textarea
                    value={scratchNotes[currentQuestion.id] ?? ""}
                    onChange={(e) =>
                      setScratchNotes((prev) => ({
                        ...prev,
                        [currentQuestion.id]: e.target.value,
                      }))
                    }
                    placeholder="Jot down your working or reasoning…"
                    className="border-border bg-background focus:border-primary focus:ring-primary/15 h-48 w-full resize-y rounded-lg border-2 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-4"
                  />
                  {currentNotes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                        Notes on highlights
                      </p>
                      {currentNotes.map((a) => (
                        <div
                          key={a.id}
                          className="border-border bg-muted/30 rounded-md border p-2 text-xs"
                        >
                          {a.text && (
                            <p className="text-muted-foreground mb-1 italic">
                              “{a.text}”
                            </p>
                          )}
                          <p className="text-foreground">{a.note}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-muted-foreground text-xs">
                    Tip: select text in the passage to highlight, underline, or
                    attach a note.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No active question.</p>
              )}
            </div>
          </div>
        )}

        {/* Main */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Docked calculator: Bluebook, wide screens: sits beside the
              question, never covers it. Header carries the Bluebook
              Graphing | Scientific tabs + expand (large, never full-screen)
              + close. */}
          {bluebook && isWideScreen && calcOpen && (
            <div
              className={cn(
                "border-border bg-card flex shrink-0 flex-col border-r transition-[width] duration-200 ease-out",
                calcExpanded ? "w-[min(62vw,56rem)]" : "w-[26rem] xl:w-[30rem]"
              )}
            >
              <div className="bg-muted/60 border-border flex items-center justify-between border-b px-2.5 py-1.5">
                <div className="border-border bg-background flex items-center gap-0.5 rounded-md border p-0.5">
                  {(["GRAPHING", "SCIENTIFIC"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setCalcTab(tab)}
                      aria-pressed={calcTab === tab}
                      className={cn(
                        "rounded px-2.5 py-1 text-xs font-semibold transition-colors",
                        calcTab === tab
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab === "GRAPHING" ? "Graphing" : "Scientific"}
                    </button>
                  ))}
                </div>
                <span className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCalcExpanded((v) => !v)}
                    aria-label={calcExpanded ? "Shrink calculator" : "Expand calculator"}
                    title={calcExpanded ? "Shrink" : "Expand"}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {calcExpanded ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcOpen(false)}
                    aria-label="Close calculator"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              </div>
              <div className="min-h-0 flex-1">
                {calcTab === "GRAPHING" ? (
                  <GraphingCalculator bare />
                ) : (
                  <div className="h-full overflow-y-auto">
                    <ScientificCalculator bare />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Left/main pane */}
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* Section tabs (generic player only, a Bluebook module is a
                single section, and Bluebook shows no tab strip) */}
            {!bluebook && (
            <div className="border-border bg-card flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-2 sm:px-6">
              {sections.map((s) => {
                const isActive = s.id === activeSectionId;
                const sectionAnswered = s.questionIds.filter((qid) => {
                  const a = answers[qid];
                  if (!a) return false;
                  return (
                    a.answer !== null &&
                    a.answer !== undefined &&
                    a.answer !== "" &&
                    !(Array.isArray(a.answer) && a.answer.length === 0)
                  );
                }).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveSectionId(s.id);
                      // Jump to first question of section
                      if (s.questionIds[0]) jumpToQuestion(s.questionIds[0], s.id);
                    }}
                    className={cn(
                      "relative inline-flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full transition-colors",
                        sectionAnswered === s.questionIds.length &&
                          s.questionIds.length > 0
                          ? "bg-emerald-500"
                          : sectionAnswered > 0
                            ? "bg-amber-400"
                            : "bg-border",
                      )}
                      aria-hidden
                    />
                    <span>{s.name}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {sectionAnswered}/{s.questionIds.length}
                    </span>
                    {isActive && (
                      <span
                        className="bg-primary absolute -bottom-[9px] left-2 right-2 h-[2px] rounded-full"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
            )}

            {/* Question. Bluebook: the page never scrolls, the layout is
                viewport-fixed and each pane scrolls internally, no matter how
                long the passage or options are. */}
            <div
              className={cn(
                "flex-1 px-3 py-4 sm:px-6 sm:py-6",
                bluebook
                  ? "min-h-0 overflow-y-auto lg:flex lg:flex-col lg:overflow-hidden"
                  : "overflow-y-auto"
              )}
            >
              {bluebook && reviewOpen ? (
                /* Bluebook "Check Your Work" page, shown after the last
                   question; footer Next submits the module from here. */
                <div className="mx-auto w-full max-w-3xl py-6 text-center sm:py-10 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                  <h2 className="text-foreground text-2xl font-bold sm:text-3xl">
                    Check Your Work
                  </h2>
                  <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-relaxed">
                    On test day, you won&apos;t be able to move on to the next
                    module until time expires. For these practice questions, you
                    can select <span className="font-semibold">Next</span> when
                    you&apos;re ready to move on.
                  </p>
                  <div className="border-border bg-card mt-8 rounded-xl border p-4 text-left shadow-md sm:p-6">
                    <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b border-dashed pb-3">
                      <p className="text-foreground text-sm font-semibold">
                        {bluebookModuleLabel}
                      </p>
                      <BluebookNavLegend />
                    </div>
                    <div className="mt-4 pt-2">
                      <BluebookNavGrid
                        items={flatQuestionList}
                        answers={answers}
                        currentQuestionId={currentQuestionId}
                        onJump={(qid, sectionId) => {
                          setReviewOpen(false);
                          jumpToQuestion(qid, sectionId);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : currentQuestion && currentIndex >= 0 ? (
                <div
                  key={currentQuestion.id}
                  className={cn(
                    "mx-auto w-full max-w-[1600px] animate-[questionFade_220ms_ease-out]",
                    bluebook && "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
                  )}
                >
                  <div
                    className={cn(
                      "bg-card border-border relative overflow-hidden rounded-xl border shadow-md",
                      bluebook && "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
                    )}
                  >
                    {bluebook ? (
                      /* Bluebook question strip: black number chip, Mark for
                         Review flag, ABC answer-eliminator toggle. */
                      <div className="border-border bg-muted/50 flex items-stretch border-b border-dashed">
                        <span
                          className="bg-foreground text-background flex w-10 shrink-0 items-center justify-center text-base font-bold tabular-nums"
                          title={`Question ${currentIndex + 1} of ${flatQuestionList.length}`}
                        >
                          {currentIndex + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            toggleMarkForReview(currentQuestion.id);
                            queueAnswerSave(currentQuestion.id);
                          }}
                          className="text-muted-foreground hover:text-foreground ml-3 inline-flex items-center gap-1.5 py-2.5 text-sm font-medium"
                          aria-pressed={Boolean(
                            answers[currentQuestion.id]?.markedForReview
                          )}
                        >
                          <Bookmark
                            className={cn(
                              "h-4 w-4",
                              answers[currentQuestion.id]?.markedForReview &&
                                "fill-red-500 text-red-500"
                            )}
                          />
                          Mark for Review
                        </button>
                        {(currentQuestion.type === "MCQ_SINGLE" ||
                          currentQuestion.type === "MCQ_MULTI" ||
                          currentQuestion.type === "TRUE_FALSE") && (
                          <button
                            type="button"
                            onClick={() => setElimMode((v) => !v)}
                            title="Cross out answer choices you think are wrong"
                            aria-pressed={elimMode}
                            className={cn(
                              "ml-auto mr-2 self-center rounded border px-1.5 py-0.5 text-xs font-bold tracking-tight transition-colors",
                              elimMode
                                ? "border-foreground bg-foreground text-background"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <span className="line-through">ABC</span>
                          </button>
                        )}
                      </div>
                    ) : (
                    <div className="from-primary/15 via-primary/8 to-primary/0 relative flex flex-wrap items-center gap-2 border-b border-border/60 bg-gradient-to-r px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
                      <span
                        className="bg-primary text-primary-foreground inline-flex h-9 min-w-[52px] items-center justify-center rounded-lg px-2 font-mono text-sm font-bold tracking-tight shadow-sm sm:h-10 sm:min-w-[60px] sm:text-base"
                        title={`Question ${currentIndex + 1} of ${flatQuestionList.length}`}
                      >
                        Q{currentIndex + 1}
                      </span>
                      <div className="flex flex-col leading-tight">
                        <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                          of {flatQuestionList.length}
                        </span>
                        <QuestionTypePill type={currentQuestion.type} />
                      </div>

                      {/* Bluebook shows no marks / negative-marking per question.
                          Keep only a discreet per-question timer as a study aid. */}
                      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                        <span
                          className="text-muted-foreground bg-card/60 hidden items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs tabular-nums sm:inline-flex"
                          title="Time on this question"
                        >
                          <Timer className="h-3 w-3" />
                          {formatTime(questionTickSec)}
                        </span>
                      </div>
                    </div>
                    )}

                    {/* DRAG_DROP renders its own stem (with the inline blank)
                        inside QuestionView, so it stays single-column. Every
                        other type uses the College Board "Bluebook" split:
                        passage / stem on the left, question + options on the
                        right (stacked on mobile). */}
                    {currentQuestion.type === "DRAG_DROP" ? (
                      <div
                        className={cn(
                          "relative space-y-5 p-4 sm:p-6",
                          bluebook && "lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
                        )}
                      >
                        <div className="text-foreground prose prose-sm dark:prose-invert max-w-none text-base leading-relaxed">
                          {renderStemImageOnly(currentQuestion.stem)}
                        </div>
                        <QuestionView
                          question={currentQuestion}
                          answer={answers[currentQuestion.id]?.answer ?? null}
                          onChange={handleAnswerChange}
                          eliminated={eliminated[currentQuestion.id]}
                          onToggleEliminate={
                            // Bluebook gates per-option strikeouts behind the
                            // ABC toggle; the generic player always shows them.
                            !bluebook || elimMode
                              ? (o) => toggleEliminate(currentQuestion.id, o)
                              : undefined
                          }
                          bluebook={bluebook}
                        />
                      </div>
                    ) : (
                      <div
                        ref={splitRef}
                        className={cn(
                          "relative flex flex-col",
                          // Descriptive answers get a full-width stacked layout
                          // (stem on top, answer textarea below), the side-by-side
                          // split is only useful for passage + options types.
                          currentQuestion.type !== "DESCRIPTIVE" && "lg:flex-row",
                          bluebook && "lg:min-h-0 lg:flex-1"
                        )}
                      >
                        {/* Passage / stem, left pane (highlight / underline / note) */}
                        <div
                          className={cn(
                            "text-foreground prose prose-sm dark:prose-invert max-w-none p-4 text-base leading-relaxed sm:p-6",
                            currentQuestion.type === "DESCRIPTIVE"
                              ? "w-full"
                              : bluebook
                                ? "lg:max-h-full lg:overflow-y-auto"
                                : "lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto"
                          )}
                          style={
                            isWideScreen &&
                            currentQuestion.type !== "DESCRIPTIVE"
                              ? { width: `${splitPct}%` }
                              : undefined
                          }
                        >
                          <HighlightablePassage
                            questionId={currentQuestion.id}
                            annotations={annotations.getForQuestion(currentQuestion.id)}
                            onAdd={annotations.addAnnotation}
                            onRemove={annotations.removeAnnotation}
                            onSetNote={annotations.setNote}
                          >
                            {renderStem(currentQuestion.stem)}
                          </HighlightablePassage>
                        </div>
                        {/* Draggable divider (Bluebook), desktop only. Hidden for
                            descriptive (stacked) questions. */}
                        {currentQuestion.type !== "DESCRIPTIVE" && (
                          <div
                            onPointerDown={startSplitDrag}
                            role="separator"
                            aria-orientation="vertical"
                            aria-label="Resize passage and question panes"
                            className="border-border hover:bg-muted group relative hidden w-px shrink-0 cursor-col-resize select-none border-l lg:block"
                          >
                            <span className="bg-foreground/80 group-hover:bg-primary absolute left-1/2 top-1/2 flex h-7 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[3px] text-[8px] text-background shadow">
                              ⟷
                            </span>
                          </div>
                        )}
                        {/* Question + options, right pane (full-width bottom for
                            descriptive) */}
                        <div
                          className={cn(
                            "flex-1 p-4 sm:p-6",
                            currentQuestion.type === "DESCRIPTIVE"
                              ? "w-full"
                              : bluebook
                                ? "lg:max-h-full lg:overflow-y-auto"
                                : "lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto"
                          )}
                        >
                          <QuestionView
                            question={currentQuestion}
                            answer={answers[currentQuestion.id]?.answer ?? null}
                            onChange={handleAnswerChange}
                            eliminated={eliminated[currentQuestion.id]}
                            onToggleEliminate={
                              // Bluebook gates per-option strikeouts behind the
                              // ABC toggle; the generic player always shows them.
                              !bluebook || elimMode
                                ? (o) => toggleEliminate(currentQuestion.id, o)
                                : undefined
                            }
                            bluebook={bluebook}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center">
                  No questions in this section.
                </p>
              )}
            </div>

            {/* Controls */}
            {bluebook ? (
              /* Bluebook footer: student name (left), "Question X of Y"
                 navigator popup (center), Back / Next pills (right).
                 pr clears the globally-fixed ContactWidget (bottom-6 right-6,
                 56px circle) so the Back/Next pills aren't covered by it. */
              <footer className="border-border bg-card relative grid shrink-0 grid-cols-3 items-center gap-2 border-t px-3 py-3 pr-20 sm:px-6 sm:pr-24">
                <div className="text-foreground truncate text-sm font-semibold">
                  {studentName}
                </div>
                <div className="flex justify-center">
                  {!reviewOpen && (
                    <button
                      type="button"
                      onClick={() => setNavOpen((v) => !v)}
                      aria-expanded={navOpen}
                      className="bg-foreground text-background inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold shadow-md sm:px-4 sm:text-sm"
                    >
                      Question {currentIndex + 1} of {flatQuestionList.length}
                      <ChevronUp
                        className={cn(
                          "h-4 w-4 transition-transform",
                          navOpen && "rotate-180"
                        )}
                      />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  {reviewOpen ? (
                    <>
                      <Button
                        variant="outline"
                        className="rounded-full px-5 sm:px-7"
                        onClick={() => setReviewOpen(false)}
                        disabled={moduleSubmitting || submitMutation.isPending}
                      >
                        Back
                      </Button>
                      <Button
                        className="rounded-full px-5 sm:px-7"
                        disabled={moduleSubmitting || submitMutation.isPending}
                        onClick={() => {
                          // Bluebook: Next on Check Your Work moves straight
                          // into the next module (or finishes the test).
                          if (isAdaptive) void handleModuleSubmit(false);
                          else void handleSubmit(false);
                        }}
                      >
                        {(moduleSubmitting || submitMutation.isPending) && (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        )}
                        Next
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        className="rounded-full px-5 sm:px-7"
                        onClick={goPrev}
                        disabled={currentIndex <= 0}
                      >
                        Back
                      </Button>
                      <Button
                        className="rounded-full px-5 sm:px-7"
                        onClick={handleBluebookNext}
                      >
                        Next
                      </Button>
                    </>
                  )}
                </div>

                {/* Question navigator popup, anchored above the footer pill */}
                {navOpen && !reviewOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setNavOpen(false)}
                      role="presentation"
                    />
                    <div
                      className="border-border bg-card absolute bottom-full left-1/2 z-50 mb-2 w-[min(92vw,540px)] -translate-x-1/2 rounded-lg border p-4 shadow-2xl"
                      role="dialog"
                      aria-label="Question navigator"
                    >
                      <div className="relative mb-3 pr-6 text-center">
                        <p className="text-foreground text-sm font-semibold">
                          {bluebookModuleLabel}
                        </p>
                        <button
                          type="button"
                          onClick={() => setNavOpen(false)}
                          aria-label="Close navigator"
                          className="text-muted-foreground hover:text-foreground absolute right-0 top-0 rounded p-0.5"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="border-border mb-3 flex items-center justify-center border-y border-dashed py-2">
                        <BluebookNavLegend />
                      </div>
                      {/* pt-3 keeps the current-question pin from clipping */}
                      <div className="max-h-56 overflow-y-auto pt-3">
                        <BluebookNavGrid
                          items={flatQuestionList}
                          answers={answers}
                          currentQuestionId={currentQuestionId}
                          onJump={(qid, sectionId) => {
                            setNavOpen(false);
                            jumpToQuestion(qid, sectionId);
                          }}
                        />
                      </div>
                      <div className="mt-4 flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full px-5"
                          onClick={() => {
                            if (currentQuestionId) queueAnswerSave(currentQuestionId);
                            setNavOpen(false);
                            setReviewOpen(true);
                          }}
                        >
                          Go to Review Page
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </footer>
            ) : (
            <footer className="border-border bg-card flex shrink-0 items-center justify-between gap-2 border-t px-3 py-3 pr-20 sm:px-6 sm:pr-24">
              {/* Left: secondary actions */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goPrev}
                  disabled={currentIndex <= 0}
                  aria-label="Previous question"
                  className="px-2 sm:px-3"
                >
                  <ChevronLeft className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="hidden sm:inline-flex"
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleMark}
                  disabled={!currentQuestionId}
                  aria-pressed={Boolean(
                    currentQuestionId &&
                      answers[currentQuestionId]?.markedForReview
                  )}
                  aria-label={
                    currentQuestionId &&
                    answers[currentQuestionId]?.markedForReview
                      ? "Remove review mark"
                      : "Mark for review"
                  }
                  className="px-2 sm:px-3"
                >
                  <Bookmark
                    className={cn(
                      "h-4 w-4 sm:mr-1",
                      currentQuestionId &&
                        answers[currentQuestionId]?.markedForReview &&
                        "fill-red-500 text-red-500"
                    )}
                  />
                  <span className="hidden sm:inline">
                    {currentQuestionId &&
                    answers[currentQuestionId]?.markedForReview
                      ? "Marked"
                      : "Mark for Review"}
                  </span>
                </Button>
                <button
                  type="button"
                  onClick={() => setShowShortcuts(true)}
                  className="text-muted-foreground hover:text-foreground hidden items-center gap-1 text-xs sm:inline-flex"
                  aria-label="Show keyboard shortcuts"
                  title="Keyboard shortcuts (?)"
                >
                  <Keyboard className="h-3.5 w-3.5" />
                  <span>Shortcuts</span>
                </button>
              </div>

              {/* Primary CTA, fills more of the row on mobile so it's clearly the next step */}
              <Button
                onClick={handleSaveAndNext}
                disabled={currentIndex >= flatQuestionList.length - 1}
                className="from-primary to-primary/90 hover:to-primary h-10 flex-1 bg-gradient-to-r px-4 text-sm font-semibold shadow-md transition-all duration-150 hover:shadow-lg disabled:bg-muted disabled:bg-none sm:flex-none sm:px-5"
              >
                Save &amp; Next
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </footer>
            )}
          </main>

          {/* Docked reference sheet: Bluebook, wide screens: the question
              reflows, nothing is covered. Expandable, never full-screen. */}
          {bluebook && isWideScreen && formulaOpen && (
            <div
              className={cn(
                "shrink-0 transition-[width] duration-200 ease-out",
                refExpanded ? "w-[min(48vw,44rem)]" : "w-96"
              )}
            >
              <FormulaSheet
                docked
                expanded={refExpanded}
                onToggleExpand={() => setRefExpanded((v) => !v)}
                onClose={() => setFormulaOpen(false)}
              />
            </div>
          )}

          {/* Palette (right pane on desktop, bottom sheet on mobile). Bluebook
              navigates via the footer "Question X of Y" popup instead. */}
          {!bluebook && (
          <aside
            className={cn(
              "border-border bg-card hidden shrink-0 overflow-y-auto border-l lg:block lg:w-72"
            )}
          >
            <PaletteContent
              sections={sections}
              activeSectionId={activeSectionId}
              currentQuestionId={currentQuestionId}
              answers={answers}
              onJump={jumpToQuestion}
            />
          </aside>
          )}
        </div>

        {/* Mobile palette as sheet */}
        {paletteOpen && !bluebook && (
          <div
            className="fixed inset-0 z-50 bg-black/40 lg:hidden"
            onClick={() => setPaletteOpen(false)}
            role="presentation"
          >
            <div
              className="bg-card absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-xl p-4"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="bg-muted mx-auto mb-3 h-1 w-12 rounded-full" />
              <PaletteContent
                sections={sections}
                activeSectionId={activeSectionId}
                currentQuestionId={currentQuestionId}
                answers={answers}
                onJump={jumpToQuestion}
              />
            </div>
          </div>
        )}

        {/* Keyboard shortcuts overlay */}
        {showShortcuts && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowShortcuts(false)}
            role="presentation"
          >
            <div
              className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-foreground inline-flex items-center gap-2 text-base font-semibold">
                  <Keyboard className="h-4 w-4" />
                  Keyboard shortcuts
                </h2>
                <button
                  onClick={() => setShowShortcuts(false)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                  aria-label="Close"
                >
                  Esc
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <ShortcutRow keys={["1", "2", "3", "4"]} label="Pick option A–D" />
                <ShortcutRow keys={["?"]} label="Toggle this help" />
                <ShortcutRow keys={["Esc"]} label="Close help" />
              </div>
              <p className="text-muted-foreground mt-4 text-xs">
                Tip: shortcuts are ignored while you&apos;re typing into a text
                box (e.g. fill-in-the-blank).
              </p>
            </div>
          </div>
        )}

        {/* Bluebook 5-minute warning, shown once per module; the timer stays
            visible and red from here on. */}
        <AlertDialog open={fiveMinAlert} onOpenChange={setFiveMinAlert}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-red-600" />5 Minutes Remaining
              </AlertDialogTitle>
              <AlertDialogDescription>
                Your timer will stay visible for the rest of this module. Keep
                working, your answers are saved automatically.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setFiveMinAlert(false)}>
                Close
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Submit confirmation */}
        <AlertDialog
          open={showSubmitConfirm}
          onOpenChange={setShowSubmitConfirm}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isAdaptive
                  ? isLastModule
                    ? "Finish the test?"
                    : `Submit Module ${adaptive?.moduleOrdinal ?? ""}?`
                  : "Submit test?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isAdaptive
                  ? isLastModule
                    ? "This is the final module. Submitting completes the test."
                    : "You cannot return to this module. The next module is chosen from your performance and starts immediately."
                  : "Once submitted, you cannot change your answers."}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* Segmented progress: emerald = answered, purple = marked-only,
                muted = not attempted. Widths sum to 100% of total. */}
            <SubmitBreakdown counts={counts} />

            <div className="my-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Counter label="Total" value={counts.total} />
              <Counter label="Answered" value={counts.answered} accent="green" />
              <Counter label="Marked" value={counts.marked} accent="purple" />
              <Counter label="Not visited" value={counts.notVisited} accent="muted" />
            </div>

            {/* Bluebook-style review grid: click any question to revisit it
                before submitting (filled = answered, dashed = unanswered,
                flag = marked for review). */}
            {currentSection && (
              <div className="mt-1">
                <p className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase tracking-wide">
                  Review, tap a question to go back
                </p>
                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {currentSection.questionIds.map((qid, idx) => {
                    const ps = getPaletteState(qid, answers);
                    const flagged =
                      ps === "marked" || ps === "marked_answered";
                    return (
                      <button
                        key={qid}
                        type="button"
                        onClick={() => {
                          setShowSubmitConfirm(false);
                          jumpToQuestion(qid, currentSection.id);
                        }}
                        className={cn(
                          "relative h-8 w-8 rounded-md text-xs font-semibold transition-transform hover:scale-105",
                          PALETTE_CLASSES[ps]
                        )}
                        aria-label={`Review question ${idx + 1}${flagged ? " (marked for review)" : ""}`}
                      >
                        {idx + 1}
                        {flagged && (
                          <Flag className="absolute -right-1 -top-1 h-2.5 w-2.5 fill-red-500 text-red-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <AlertDialogFooter className={isAdaptive && !isLastModule ? "sm:justify-between" : undefined}>
              {isAdaptive && !isLastModule && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setShowSubmitConfirm(false);
                    void handleSubmit(false);
                  }}
                  disabled={submitMutation.isPending || moduleSubmitting}
                >
                  End entire test now
                </Button>
              )}
              <div className="flex gap-2">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setShowSubmitConfirm(false);
                    if (isAdaptive) {
                      void handleModuleSubmit(false);
                    } else {
                      void handleSubmit(false);
                    }
                  }}
                  disabled={submitMutation.isPending || moduleSubmitting}
                >
                  {(submitMutation.isPending || moduleSubmitting) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isAdaptive
                    ? isLastModule
                      ? "Finish Test"
                      : "Submit Module"
                    : "Submit"}
                </AlertDialogAction>
              </div>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Between-module interstitial (generic adaptive only: Bluebook moves
            straight into the next module so no clock time is lost). */}
        {intermission && adaptive && !bluebook && (
          <ModuleIntermission
            finishedOrdinal={intermission.finishedOrdinal}
            nextOrdinal={adaptive.moduleOrdinal}
            totalModules={adaptive.totalModules}
            nextSectionName={adaptive.sectionName ?? ""}
            nextQuestionCount={sections.reduce(
              (sum, s) => sum + s.questionIds.length,
              0
            )}
            nextDurationSec={store.totalDurationSec}
            onContinue={() => setIntermission(null)}
          />
        )}

        {/* A required camera/mic that is refused or switched off blocks the
            test until it is back on. A toast used to be all that happened. */}
        {proctoringActive && proctorMediaError && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4">
            <div className="bg-card w-full max-w-md rounded-xl p-6 text-center shadow-xl">
              <AlertTriangle className="text-destructive mx-auto h-10 w-10" />
              <h2 className="text-foreground mt-3 text-lg font-semibold">
                Camera / microphone needed
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">{proctorMediaError}</p>
              <p className="text-muted-foreground mt-2 text-sm">
                Click the lock icon next to the website address, allow access, then
                click Try again. Your timer keeps running.
              </p>
              <Button className="mt-4" onClick={retryMedia}>
                Try again
              </Button>
            </div>
          </div>
        )}
      </div>
    </TenantThemeProvider>
  );
}

// Bluebook header tool button: icon over a tiny label ("Highlights & Notes",
// "Reference", "Calculator", "More").
function HeaderTool({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground relative flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
        active && "bg-primary/10 text-primary"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden whitespace-nowrap sm:block">{label}</span>
      {badge !== undefined && (
        <span className="bg-primary text-primary-foreground absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

function MoreMenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-foreground hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
    >
      <Icon className="text-muted-foreground h-4 w-4" />
      {label}
    </button>
  );
}

// Bluebook navigator legend: Current / Unanswered / For Review.
function BluebookNavLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
      <span className="inline-flex items-center gap-1.5">
        <MapPin className="text-foreground h-3.5 w-3.5" />
        Current
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="border-muted-foreground/50 bg-card inline-block h-4 w-4 rounded-[3px] border border-dashed" />
        Unanswered
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Flag className="h-3.5 w-3.5 fill-red-500 text-red-500" />
        For Review
      </span>
    </div>
  );
}

// Bluebook question grid shared by the footer navigator popup and the
// Check Your Work page: answered = filled, unanswered = dashed outline,
// current = location pin, marked = red flag.
function BluebookNavGrid({
  items,
  answers,
  currentQuestionId,
  onJump,
}: {
  items: Array<{ qid: string; sectionId: string }>;
  answers: ReturnType<typeof useTestAttemptStore.getState>["answers"];
  currentQuestionId: string | null;
  onJump: (qid: string, sectionId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ qid, sectionId }, idx) => {
        const ps = getPaletteState(qid, answers);
        const flagged = ps === "marked" || ps === "marked_answered";
        const isCurrent = qid === currentQuestionId;
        return (
          <button
            key={qid}
            type="button"
            onClick={() => onJump(qid, sectionId)}
            className={cn(
              "relative h-9 w-9 rounded-md text-xs font-semibold transition-transform hover:scale-105",
              PALETTE_CLASSES[ps],
              isCurrent && "ring-primary ring-2 ring-offset-2 ring-offset-background"
            )}
            aria-label={`Question ${idx + 1}${flagged ? " (marked for review)" : ""}${isCurrent ? " (current)" : ""}`}
            aria-current={isCurrent ? "true" : undefined}
          >
            {idx + 1}
            {isCurrent && (
              <MapPin className="text-foreground absolute -top-2.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 drop-shadow" />
            )}
            {flagged && (
              <Flag className="absolute -right-1 -top-1 h-3 w-3 fill-red-500 text-red-500 drop-shadow" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function Counter({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "green" | "purple" | "muted";
}) {
  return (
    <div className="bg-muted/40 rounded-md p-2 text-center">
      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          accent === "green" && "text-green-600",
          accent === "purple" && "text-purple-600",
          accent === "muted" && "text-muted-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PaletteContent({
  sections,
  activeSectionId,
  currentQuestionId,
  answers,
  onJump,
}: {
  sections: ReturnType<typeof useTestAttemptStore.getState>["sections"];
  activeSectionId: string | null;
  currentQuestionId: string | null;
  answers: ReturnType<typeof useTestAttemptStore.getState>["answers"];
  onJump: (qid: string, sectionId: string) => void;
}) {
  // Overall completion for the progress ring
  const totalQuestions = sections.reduce(
    (sum, s) => sum + s.questionIds.length,
    0,
  );
  const totalAnswered = sections.reduce(
    (sum, s) =>
      sum +
      s.questionIds.filter((qid) => {
        const a = answers[qid];
        if (!a) return false;
        return (
          a.answer !== null &&
          a.answer !== undefined &&
          a.answer !== "" &&
          !(Array.isArray(a.answer) && a.answer.length === 0)
        );
      }).length,
    0,
  );
  const overallPct =
    totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0;

  return (
    <div className="space-y-4 p-4">
      {/* Overall progress ring */}
      <div className="bg-card border-border flex items-center gap-3 rounded-lg border p-3 shadow-sm">
        <ProgressRing percent={overallPct} size={52} />
        <div className="flex flex-col leading-tight">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
            Overall
          </span>
          <span className="text-foreground font-mono text-lg font-bold tabular-nums">
            {totalAnswered}
            <span className="text-muted-foreground text-sm">
              {" "}/ {totalQuestions}
            </span>
          </span>
          <span className="text-muted-foreground text-xs">
            {Math.round(overallPct)}% answered
          </span>
        </div>
      </div>

      {/* Bluebook-style legend: Current / Unanswered / For review */}
      <div className="bg-muted/40 rounded-lg p-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="border-primary ring-primary ring-offset-background inline-block h-4 w-4 rounded-[3px] border ring-2 ring-offset-1" />
            Current
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="border-muted-foreground/50 bg-card inline-block h-4 w-4 rounded-[3px] border border-dashed" />
            Unanswered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Flag className="h-3.5 w-3.5 fill-red-500 text-red-500" />
            For review
          </span>
        </div>
      </div>

      {sections.map((s) => {
        const isActive = s.id === activeSectionId;
        const sectionAnswered = s.questionIds.filter((qid) => {
          const a = answers[qid];
          if (!a) return false;
          return (
            a.answer !== null &&
            a.answer !== undefined &&
            a.answer !== "" &&
            !(Array.isArray(a.answer) && a.answer.length === 0)
          );
        }).length;
        return (
          <div
            key={s.id}
            className={cn(
              "border-border bg-card rounded-lg border p-3 transition-opacity",
              !isActive && "opacity-70",
            )}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-foreground text-xs font-semibold">{s.name}</p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {sectionAnswered}/{s.questionIds.length}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {s.questionIds.map((qid, idx) => {
                const ps = getPaletteState(qid, answers);
                const isCurrent = qid === currentQuestionId;
                const flagged = ps === "marked" || ps === "marked_answered";
                return (
                  <button
                    key={qid}
                    onClick={() => onJump(qid, s.id)}
                    className={cn(
                      "relative h-9 w-9 rounded-md text-xs font-semibold transition-all duration-150 hover:scale-105 hover:shadow-sm",
                      PALETTE_CLASSES[ps],
                      isCurrent &&
                        "ring-primary scale-110 shadow-md ring-2 ring-offset-2 ring-offset-background",
                    )}
                    aria-label={`Question ${idx + 1}${flagged ? " (marked for review)" : ""}`}
                  >
                    {idx + 1}
                    {flagged && (
                      <Flag className="absolute -right-1 -top-1 h-3 w-3 fill-red-500 text-red-500 drop-shadow" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProgressRing({
  percent,
  size = 48,
}: {
  percent: number;
  size?: number;
}) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        className="stroke-muted fill-none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        strokeLinecap="round"
        className="stroke-primary fill-none transition-[stroke-dasharray] duration-500 ease-out"
        strokeDasharray={`${dash} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

const QUESTION_TYPE_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  MCQ_SINGLE: { label: "Single answer", icon: CircleDot },
  MCQ_MULTI: { label: "Multi answer", icon: ListChecks },
  TRUE_FALSE: { label: "True / False", icon: CircleDot },
  FIB: { label: "Fill in the blank", icon: Pencil },
  NAT: { label: "Numerical", icon: Hash },
  DRAG_DROP: { label: "Drag & drop", icon: Pencil },
  DESCRIPTIVE: { label: "Descriptive", icon: FileText },
};

function QuestionTypePill({ type }: { type: string }) {
  const meta = QUESTION_TYPE_META[type];
  const Icon = meta?.icon ?? CircleDot;
  const label = meta?.label ?? type.replace(/_/g, " ");
  return (
    <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function AutosaveBadge({
  status,
}: {
  status: "idle" | "saving" | "saved" | "error";
}) {
  if (status === "idle") return null;
  return (
    <span
      className={cn(
        "hidden items-center gap-1 text-xs sm:inline-flex",
        status === "saving" && "text-muted-foreground",
        status === "saved" && "text-emerald-600 dark:text-emerald-400",
        status === "error" && "text-destructive",
      )}
      aria-live="polite"
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3 w-3" />
          Saved
        </>
      )}
      {status === "error" && (
        <>
          <CircleAlert className="h-3 w-3" />
          Save failed
        </>
      )}
    </span>
  );
}

function ShortcutRow({
  keys,
  label,
}: {
  keys: string[];
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="border-border bg-muted text-foreground inline-flex min-w-[24px] justify-center rounded border px-1.5 py-0.5 font-mono text-xs"
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function SubmitBreakdown({
  counts,
}: {
  counts: { total: number; answered: number; marked: number; notVisited: number };
}) {
  if (counts.total === 0) return null;
  const answeredPct = (counts.answered / counts.total) * 100;
  // marked-only = marked questions that weren't already counted in `answered`
  // We approximate: show marked share separately from notVisited.
  const visited = counts.total - counts.notVisited;
  const markedOnlyApprox = Math.max(0, visited - counts.answered);
  const markedPct = (markedOnlyApprox / counts.total) * 100;
  const notVisitedPct = (counts.notVisited / counts.total) * 100;
  return (
    <div className="my-3 space-y-1.5">
      <div className="text-muted-foreground flex justify-between text-[10px] font-semibold uppercase tracking-wide">
        <span>Progress</span>
        <span>
          {counts.answered}/{counts.total} answered
        </span>
      </div>
      <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
        <div
          className="bg-emerald-500 transition-[width] duration-500"
          style={{ width: `${answeredPct}%` }}
          aria-label={`${counts.answered} answered`}
        />
        <div
          className="bg-purple-400 transition-[width] duration-500"
          style={{ width: `${markedPct}%` }}
          aria-label={`${markedOnlyApprox} visited but not answered`}
        />
        <div
          className="bg-border transition-[width] duration-500"
          style={{ width: `${notVisitedPct}%` }}
          aria-label={`${counts.notVisited} not visited`}
        />
      </div>
    </div>
  );
}

function TimerPill({
  seconds,
  warning,
  critical,
}: {
  seconds: number;
  warning: boolean;
  critical: boolean;
}) {
  const lastMinute = seconds > 0 && seconds <= 60;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 transition-colors sm:px-3 sm:py-1.5",
        critical
          ? "bg-destructive text-destructive-foreground border-destructive"
          : warning
            ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
            : "border-border bg-card text-foreground",
        lastMinute && !critical && "animate-pulse",
      )}
      aria-live="polite"
    >
      <Clock
        className={cn(
          "h-4 w-4 shrink-0",
          !critical && !warning && "text-muted-foreground",
        )}
      />
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "hidden text-[9px] font-semibold uppercase tracking-wider sm:inline",
            critical
              ? "text-destructive-foreground/80"
              : warning
                ? "text-red-700/70 dark:text-red-200/70"
                : "text-muted-foreground",
          )}
        >
          Time left
        </span>
        <span className="font-mono text-sm font-bold tabular-nums sm:text-base">
          {formatTime(seconds)}
        </span>
      </div>
    </div>
  );
}
