"use client";

import { Badge, Button, Card, CardContent, SkeletonRows } from "@open-mtlms/core";
import { alignDragDropAnswers } from "@open-mtlms/shared";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  CircleSlash,
  Clock,
  Download,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { MathText } from "@/components/test-series/MathText";
import {
  testsApi,
  type AttemptReviewQuestion,
  type TestQuestionType,
} from "@/lib/api/test-series";
import { testSeriesKeys } from "@/lib/hooks/use-test-series";
import { decodeEntities } from "@/lib/quiz-formats/text";
import { cn } from "@/lib/utils";
import {
  correctIdSet,
  optionParts,
  plainAnswer,
  stemParts,
} from "@/lib/utils/test-question-render";

const TYPE_LABEL: Record<TestQuestionType, string> = {
  MCQ_SINGLE: "MCQ",
  MCQ_MULTI: "MSQ",
  TRUE_FALSE: "True / False",
  FIB: "Fill in the blank",
  NAT: "Numerical",
  DRAG_DROP: "Drag and drop",
  DESCRIPTIVE: "Descriptive",
};

type Outcome = AttemptReviewQuestion["outcome"];

const OUTCOME_LABEL: Record<Outcome, string> = {
  CORRECT: "Correct",
  WRONG: "Wrong",
  SKIPPED: "Skipped",
  PENDING_REVIEW: "Awaiting grading",
};

const OUTCOME_TEXT: Record<Outcome, string> = {
  CORRECT: "text-emerald-600 dark:text-emerald-400",
  WRONG: "text-rose-600 dark:text-rose-400",
  SKIPPED: "text-muted-foreground",
  PENDING_REVIEW: "text-amber-600 dark:text-amber-400",
};

function fmtDuration(sec: number | null): string {
  if (sec == null) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

/** Plain text of a stem, for the CSV and for anything not rendered as math. */
function stemText(stem: unknown): string {
  const { text } = stemParts(stem);
  return decodeEntities(text || (typeof stem === "string" ? stem : ""));
}

/** The learner's answer as option labels where possible, else the raw value. */
function learnerAnswerLabel(q: AttemptReviewQuestion): string {
  if (q.learnerAnswer == null) return "Not answered";
  const opts = optionParts(q.options);
  if (opts.length > 0) {
    const picked = correctIdSet(q.learnerAnswer);
    const labels = opts
      .map((o, i) => ({ o, letter: letterAt(i) }))
      .filter(({ o }) => picked.has(o.id.toUpperCase()))
      .map(({ o, letter }) => `${letter}. ${decodeEntities(o.label)}`);
    if (labels.length > 0) return labels.join(" | ");
  }
  return decodeEntities(plainAnswer(q.learnerAnswer));
}

/**
 * The letter the learner saw for the option at this position. The review API
 * returns options in the learner's (possibly shuffled) order, so the position
 * is what was on their screen; the option id is the authored letter and would
 * name a different option whenever the test shuffles options.
 */
function letterAt(index: number): string {
  return String.fromCharCode(65 + index);
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Where a learner is losing marks, rolled up by the finest tag a question
 * carries. This is the reason faculty asked for the screen: a list of wrong
 * answers is evidence, a ranked list of weak topics is the actual guidance.
 */
function weakAreas(questions: AttemptReviewQuestion[]) {
  const buckets = new Map<
    string,
    { label: string; correct: number; total: number }
  >();
  for (const q of questions) {
    if (q.outcome === "PENDING_REVIEW") continue;
    const label =
      q.topic || q.chapter || q.subject || q.sectionName || "Untagged";
    const key = label.toLowerCase();
    const b = buckets.get(key) ?? { label: decodeEntities(label), correct: 0, total: 0 };
    b.total += 1;
    if (q.outcome === "CORRECT") b.correct += 1;
    buckets.set(key, b);
  }
  return Array.from(buckets.values())
    .map((b) => ({ ...b, pct: b.total > 0 ? (b.correct / b.total) * 100 : 0 }))
    .sort((a, b) => a.pct - b.pct || b.total - a.total);
}

export default function AttemptReviewPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = params?.attemptId ?? "";
  const [filter, setFilter] = useState<Outcome | "ALL">("ALL");

  const { data, isLoading, isError } = useQuery({
    queryKey: testSeriesKeys.tests.attemptReview(attemptId),
    queryFn: () => testsApi.getAttemptReview(attemptId),
    enabled: Boolean(attemptId),
  });

  const questions = useMemo(() => data?.questions ?? [], [data?.questions]);
  const visible = useMemo(
    () => (filter === "ALL" ? questions : questions.filter((q) => q.outcome === filter)),
    [questions, filter]
  );
  const areas = useMemo(() => weakAreas(questions), [questions]);

  const downloadCsv = () => {
    if (!data) return;
    const headers = [
      "#",
      "Section",
      "Subject",
      "Chapter",
      "Topic",
      "Type",
      "Difficulty",
      "Question",
      "Learner answer",
      "Correct answer",
      "Outcome",
      "Marks",
      "Marks awarded",
      "Time (sec)",
    ];
    const lines = [headers.join(",")];
    for (const q of questions) {
      const opts = optionParts(q.options);
      const correct = correctIdSet(q.correctAnswer);
      const correctLabel =
        opts.length > 0
          ? opts
              .map((o, i) => ({ o, letter: letterAt(i) }))
              .filter(({ o }) => correct.has(o.id.toUpperCase()))
              .map(({ o, letter }) => `${letter}. ${decodeEntities(o.label)}`)
              .join(" | ")
          : decodeEntities(plainAnswer(q.correctAnswer));
      lines.push(
        [
          q.order,
          q.sectionName ?? "",
          q.subject ?? "",
          q.chapter ?? "",
          q.topic ?? "",
          TYPE_LABEL[q.type] ?? q.type,
          q.difficulty ?? "",
          stemText(q.stem),
          learnerAnswerLabel(q),
          correctLabel,
          OUTCOME_LABEL[q.outcome],
          q.marks,
          q.marksAwarded,
          q.timeSpentSec,
        ]
          .map(csvCell)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.attempt.learnerName}-${data.attempt.testName}.csv`.replace(
      /[^\w.-]+/g,
      "-"
    );
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <SkeletonRows rows={8} rowClassName="h-20" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              This attempt could not be loaded.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const a = data.attempt;
  const counts: Array<{ key: Outcome | "ALL"; label: string; n: number }> = [
    { key: "ALL", label: "All", n: questions.length },
    { key: "CORRECT", label: "Correct", n: a.correctCount },
    { key: "WRONG", label: "Wrong", n: a.wrongCount },
    { key: "SKIPPED", label: "Skipped", n: a.skippedCount },
  ];
  if (a.pendingReviewCount > 0) {
    counts.push({
      key: "PENDING_REVIEW",
      label: "Awaiting grading",
      n: a.pendingReviewCount,
    });
  }

  return (
    <div className="space-y-6 p-6">
      <Link
        href={`/dashboard/test-series/tests/${a.testId}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to {a.testName}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{a.learnerName}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {a.learnerEmail ?? a.learnerPhone ?? a.learnerId}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {a.testName}
            {a.seriesTitle ? ` · ${a.seriesTitle}` : ""} · submitted{" "}
            {fmtDate(a.submittedAt)} · took {fmtDuration(a.durationSec)}
          </p>
        </div>
        <Button variant="outline" onClick={downloadCsv}>
          <Download className="mr-1 h-4 w-4" />
          Download CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Score</p>
            <p className="text-2xl font-semibold">
              {a.score ?? "-"}
              {a.totalMarks != null && (
                <span className="text-muted-foreground text-base font-normal">
                  {" "}
                  / {a.totalMarks}
                </span>
              )}
            </p>
            {a.percentage != null && (
              <p className="text-muted-foreground text-xs">{a.percentage}%</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Percentile</p>
            <p className="text-2xl font-semibold">{a.percentile ?? "-"}</p>
            <p className="text-muted-foreground text-xs">
              rank {a.rank ?? "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Right and wrong</p>
            <p className="text-2xl font-semibold">
              <span className="text-emerald-600 dark:text-emerald-400">
                {a.correctCount}
              </span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-rose-600 dark:text-rose-400">
                {a.wrongCount}
              </span>
            </p>
            <p className="text-muted-foreground text-xs">
              {a.skippedCount} skipped
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Proctoring</p>
            <p className="text-2xl font-semibold">{a.tabSwitchCount}</p>
            <p className="text-muted-foreground text-xs">tab switches</p>
          </CardContent>
        </Card>
      </div>

      {areas.length > 1 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-medium">Where marks were lost</p>
            <p className="text-muted-foreground text-xs">
              Accuracy by topic, weakest first. Questions with no subject,
              chapter or topic tag fall back to their section name.
            </p>
            <div className="space-y-1.5 pt-1">
              {areas.slice(0, 8).map((area) => (
                <div key={area.label} className="flex items-center gap-3">
                  <span className="w-48 shrink-0 truncate text-sm" title={area.label}>
                    {area.label}
                  </span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        area.pct >= 70
                          ? "bg-emerald-500"
                          : area.pct >= 40
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      )}
                      style={{ width: `${Math.max(2, area.pct)}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-24 shrink-0 text-right text-xs">
                    {area.correct}/{area.total} · {Math.round(area.pct)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-1 text-sm font-medium">Question review</p>
        {counts.map((c) => (
          <Button
            key={c.key}
            size="sm"
            variant={filter === c.key ? "default" : "outline"}
            onClick={() => setFilter(c.key)}
          >
            {c.label} ({c.n})
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No questions in this filter</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((q) => (
            <QuestionReviewCard key={q.questionId} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionReviewCard({ q }: { q: AttemptReviewQuestion }) {
  const opts = optionParts(q.options);
  const correct = correctIdSet(q.correctAnswer);
  const picked = correctIdSet(q.learnerAnswer);
  const { text, imageUrl } = stemParts(q.stem);

  // Drag and drop answers are positional, but correctIdSet flattens them into a
  // set, so two answers swapped between blanks would read as fully correct.
  // Aligning them back onto the stem shows what actually went where.
  const dragAlignment =
    q.type === "DRAG_DROP"
      ? alignDragDropAnswers(
          q.stem,
          q.learnerAnswer,
          q.correctAnswer,
          Object.fromEntries(opts.map((o) => [o.id, o.label || o.id]))
        )
      : null;
  const OutcomeIcon =
    q.outcome === "CORRECT"
      ? CheckCircle2
      : q.outcome === "WRONG"
        ? XCircle
        : q.outcome === "SKIPPED"
          ? CircleSlash
          : Clock;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <OutcomeIcon className={cn("h-4 w-4", OUTCOME_TEXT[q.outcome])} />
          <span className="font-medium">Q{q.order}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {TYPE_LABEL[q.type] ?? q.type}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className={cn("font-medium", OUTCOME_TEXT[q.outcome])}>
            {OUTCOME_LABEL[q.outcome]}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {fmtDuration(q.timeSpentSec)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {q.marksAwarded} of {q.marks} marks
          </span>
          {q.isPretest && (
            <Badge variant="outline" className="text-[10px]">
              Unscored pretest
            </Badge>
          )}
          {q.markedForReview && (
            <Badge variant="outline" className="text-[10px]">
              Marked for review
            </Badge>
          )}
          {(q.subject || q.chapter || q.topic || q.sectionName) && (
            <span className="text-muted-foreground ml-auto">
              {[q.sectionName, q.subject, q.chapter, q.topic]
                .filter(Boolean)
                .map((v) => decodeEntities(String(v)))
                .join(" · ")}
            </span>
          )}
        </div>

        {dragAlignment ? (
          <p className="text-foreground text-sm leading-8">
            {dragAlignment.blanks.map((blank, i) => (
              <span key={i}>
                <MathText block={false}>{decodeEntities(blank.before)}</MathText>
                <span
                  className={cn(
                    "mx-1 inline-flex items-center rounded-md border px-2 py-0.5 align-middle text-sm font-medium",
                    blank.given === null
                      ? "border-muted-foreground/40 text-muted-foreground border-dashed"
                      : blank.correct
                        ? "border-green-500/60 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                        : "border-red-500/60 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                  )}
                >
                  {blank.given ? decodeEntities(blank.given) : "not answered"}
                </span>
                {!blank.correct && blank.expected !== null && (
                  <span className="mr-1 align-middle text-xs font-medium text-green-700 dark:text-green-400">
                    ({decodeEntities(blank.expected)})
                  </span>
                )}
              </span>
            ))}
            <MathText block={false}>{decodeEntities(dragAlignment.tail)}</MathText>
          </p>
        ) : (
        <div className="flex items-start gap-3">
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="border-border mt-0.5 h-16 w-auto max-w-[160px] shrink-0 rounded border object-contain"
            />
          )}
          <div className="text-foreground text-sm">
            <MathText block={false}>{decodeEntities(text)}</MathText>
          </div>
        </div>
        )}

        {opts.length > 0 ? (
          <div className="space-y-1.5">
            {opts.map((o, i) => {
              const isCorrect = correct.has(o.id.toUpperCase());
              const isPicked = picked.has(o.id.toUpperCase());
              return (
                <div
                  key={o.id}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm",
                    isCorrect &&
                      "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
                    isPicked &&
                      !isCorrect &&
                      "border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30"
                  )}
                >
                  <span className="flex min-w-0 items-start gap-2">
                    <span className="text-muted-foreground shrink-0 font-medium">
                      {letterAt(i)}.
                    </span>
                    <span className="min-w-0">
                      <MathText block={false}>{decodeEntities(o.label)}</MathText>
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-2 text-xs">
                    {isPicked && (
                      <span
                        className={
                          isCorrect
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }
                      >
                        Learner answer
                      </span>
                    )}
                    {isCorrect && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Correct
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border px-3 py-2">
              <p className="text-muted-foreground text-xs">Learner answer</p>
              <p className="text-sm">
                {q.learnerAnswer == null
                  ? "Not answered"
                  : decodeEntities(plainAnswer(q.learnerAnswer))}
              </p>
            </div>
            <div className="rounded-md border px-3 py-2">
              <p className="text-muted-foreground text-xs">
                {q.type === "DESCRIPTIVE" ? "Model answer" : "Correct answer"}
              </p>
              <p className="text-sm">
                {decodeEntities(plainAnswer(q.correctAnswer))}
              </p>
            </div>
          </div>
        )}

        {q.explanation && (
          <div className="bg-muted/40 rounded-md px-3 py-2">
            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
              Explanation
            </p>
            <div className="text-sm">
              <MathText block multiline>
                {decodeEntities(q.explanation)}
              </MathText>
            </div>
          </div>
        )}

        {q.graderRemarks && (
          <div className="rounded-md border border-amber-300 px-3 py-2 dark:border-amber-900">
            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
              Evaluator remarks
            </p>
            <p className="text-sm">{decodeEntities(q.graderRemarks)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
