"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Trophy,
  XCircle,
  MinusCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  SkeletonRows,
  useToast,
} from "@open-mtlms/core";
import type { ThemeConfig, TenantLayout, DragDropAlignment } from "@open-mtlms/shared";
import { alignDragDropAnswers, getStemImageUrl } from "@open-mtlms/shared";

import { testSeriesClientApi } from "@/lib/api/test-series";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { MathText } from "@/components/test-attempt/MathText";
import { useTestResult, useTestAttempts } from "@/lib/hooks/use-test-series";
import { cn } from "@/lib/utils";
import type { ResultQuestion } from "@/lib/api/test-series";

interface Props {
  slug: string;
  testId: string;
  attemptId: string;
  theme?: ThemeConfig;
  layout?: TenantLayout | null;
}

type ReviewFilter = "all" | "correct" | "wrong" | "skipped";

function renderUnknown(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">No answer</span>;
  }
  if (typeof value === "string") return <MathText block={false}>{value}</MathText>;
  if (typeof value === "number" || typeof value === "boolean")
    return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    return <MathText block={false}>{value.map(String).join(", ")}</MathText>;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Stem JSON shape: `{ text, imageUrl?, imageSize?, html? }`. Diagram (if
    // any) renders below the text/html. The `imageSize` enum maps to a
    // Tailwind max-height class; unknown values fall back to "md".
    const imageUrl =
      typeof obj.imageUrl === "string" && obj.imageUrl.length > 0
        ? obj.imageUrl
        : null;
    const sizeRaw = obj.imageSize;
    const imageSize: "sm" | "md" | "lg" | "xl" =
      sizeRaw === "sm" || sizeRaw === "lg" || sizeRaw === "xl" ? sizeRaw : "md";
    // Always bound both dimensions, any wide source image (1920px+) would
    // otherwise stretch the review card across the page.
    const sizeClass = {
      sm: "max-h-48 max-w-xs",
      md: "max-h-72 max-w-md",
      lg: "max-h-[28rem] max-w-xl",
      xl: "max-h-[40rem] max-w-2xl",
    }[imageSize];
    let textNode: React.ReactNode = null;
    if (typeof obj.html === "string") {
      textNode = <span dangerouslySetInnerHTML={{ __html: obj.html }} />;
    } else if (typeof obj.text === "string") {
      textNode = <MathText block={false}>{obj.text}</MathText>;
    }
    if (textNode || imageUrl) {
      return (
        <>
          {textNode}
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Question diagram"
              className={`mt-2 block h-auto w-auto ${sizeClass} rounded border border-border object-contain`}
            />
          )}
        </>
      );
    }
  }
  return <code className="text-xs">{JSON.stringify(value)}</code>;
}

// Map an option id (or array of ids) to its human-readable label using the
// question's options. Used for DRAG_DROP review so we show the chosen option
// text instead of a bare id like "A". Falls back to the raw value when the
// option can't be resolved.
/**
 * A drag-and-drop stem with the learner's answers dropped back into the blanks,
 * boxed and coloured the way they looked while the test was being sat.
 *
 * The old review listed "Blank 1 / Blank 2" as cards under the stem, leaving
 * the reader counting underscores to work out which blank was which. Showing
 * the answer in place removes that step, and a wrong blank carries the expected
 * value beside it so the correction reads without cross-referencing anything.
 */
function DragDropFilledStem({ alignment }: { alignment: DragDropAlignment }) {
  return (
    <p className="text-foreground text-sm leading-8">
      {alignment.blanks.map((blank, i) => (
        <span key={i}>
          <MathText block={false}>{blank.before}</MathText>
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
            {blank.given ?? "not answered"}
          </span>
          {!blank.correct && blank.expected !== null && (
            <span className="mr-1 align-middle text-xs font-medium text-green-700 dark:text-green-400">
              ({blank.expected})
            </span>
          )}
        </span>
      ))}
      <MathText block={false}>{alignment.tail}</MathText>
    </p>
  );
}

function getOptionLabelMap(options: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  if (!Array.isArray(options)) return map;
  options.forEach((opt, idx) => {
    if (typeof opt === "object" && opt !== null) {
      const o = opt as Record<string, unknown>;
      const id = (o.id as string | undefined) ?? String(idx);
      const label =
        (o.label as string | undefined) ??
        (o.text as string | undefined) ??
        id;
      map[id] = label;
    }
  });
  return map;
}

function resolveOptionLabels(value: unknown, options: unknown): unknown {
  const map = getOptionLabelMap(options);
  if (typeof value === "string") return map[value] ?? value;
  if (Array.isArray(value)) return value.map((v) => map[String(v)] ?? v);
  return value;
}

/**
 * Human-readable NAT (numeric type-in) correct answer. The stored value can be a
 * number, a fraction string, an array of accepted values, or a
 * `{ value, tolerance }` object, the last of which was being shown as raw JSON
 * (`{"value":30,"tolerance":0.5}`). Render it as e.g. `30 (±0.5)` / `30` / `30 or 0.5`.
 */
function formatNatAnswer(value: unknown): string {
  let v = value;
  if (typeof v === "string") {
    const s = v.trim();
    if (s.startsWith("{") || s.startsWith("[")) {
      try {
        v = JSON.parse(s);
      } catch {
        return s;
      }
    } else {
      return s;
    }
  }
  if (Array.isArray(v)) {
    return v.map((x) => formatNatAnswer(x)).filter(Boolean).join(" or ");
  }
  if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
    const o = v as { value: unknown; tolerance?: unknown };
    const tolNum = Number(o.tolerance);
    const tol = Number.isFinite(tolNum) && tolNum > 0 ? ` (±${tolNum})` : "";
    return `${o.value ?? ""}${tol}`;
  }
  return v == null ? "" : String(v);
}

/** True when an answer (option id/label, or array of them) refers to this option. */
function answerRefersTo(
  answer: unknown,
  id: string,
  label: string
): boolean {
  const hit = (v: unknown) => {
    const s = String(v);
    return s === id || s === label;
  };
  if (answer == null) return false;
  if (Array.isArray(answer)) return answer.some(hit);
  return hit(answer);
}

function fmtTime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function TestAttemptHistory({
  slug,
  testId,
  currentAttemptId,
}: {
  slug: string;
  testId: string;
  currentAttemptId: string;
}) {
  const { data: attempts } = useTestAttempts(testId);
  if (!attempts || attempts.length <= 1) return null;
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Previous attempts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {attempts.map((a) => {
          const active = a.id === currentAttemptId;
          const submitted =
            a.status === "SUBMITTED" || a.status === "AUTO_SUBMITTED";
          return (
            <Link
              key={a.id}
              href={`/test-series/${slug}/${testId}/result/${a.id}`}
              className={cn(
                "flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors",
                active
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:bg-muted/40"
              )}
            >
              <span className="text-foreground font-medium">
                Attempt {a.attempt_number}
                {active && (
                  <span className="text-primary ml-2 text-xs">(viewing)</span>
                )}
              </span>
              <span className="text-muted-foreground">
                {submitted && a.percentage != null
                  ? `${Math.round(a.percentage)}%`
                  : a.status === "IN_PROGRESS"
                    ? "In progress"
                    : "-"}
              </span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ResultClient({ slug, testId, attemptId, theme, layout }: Props) {
  const { data: result, isLoading, error } = useTestResult(attemptId);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await testSeriesClientApi.downloadResultPdf(attemptId);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  // A question keeps its own number under every filter: "Wrong" used to
  // renumber from 1, so a learner's "Q6" was not question 6 of their test and
  // never matched the staff review of the same attempt.
  const questionNumber = useMemo(
    () => new Map((result?.questions ?? []).map((q, i) => [q.questionId, i + 1])),
    [result?.questions]
  );

  const filteredQuestions = useMemo(() => {
    if (!result) return [];
    return result.questions.filter((q) => {
      switch (filter) {
        case "correct":
          return q.isCorrect === true;
        case "wrong":
          return q.isCorrect === false;
        case "skipped":
          // Descriptive answers are always isCorrect === null (manually graded),
          // so exclude them from "skipped", they aren't right/wrong/skipped.
          return q.isCorrect === null && q.type !== "DESCRIPTIVE";
        default:
          return true;
      }
    });
  }, [result, filter]);

  if (isLoading) {
    return (
      <LayoutWrapper layout={layout ?? null} theme={theme}>
        <TenantThemeProvider theme={theme}>
          <div className="container mx-auto max-w-5xl px-4 py-8">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-6 h-40 w-full" />
            <Skeleton className="mt-6 h-56 w-full" />
            <SkeletonRows rows={4} rowClassName="h-24" className="mt-6" />
          </div>
        </TenantThemeProvider>
      </LayoutWrapper>
    );
  }

  if (error || !result) {
    return (
      <LayoutWrapper layout={layout ?? null} theme={theme}>
        <TenantThemeProvider theme={theme}>
          <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
            <h1 className="text-foreground text-2xl font-bold">Result not found</h1>
            <Link href={`/test-series/${slug}/dashboard`}>
              <Button variant="outline" className="mt-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to series
              </Button>
            </Link>
          </div>
        </TenantThemeProvider>
      </LayoutWrapper>
    );
  }

  const passed = result.passed;
  const accentClass =
    passed === true
      ? "text-green-600"
      : passed === false
        ? "text-red-600"
        : "text-foreground";

  return (
    <LayoutWrapper layout={layout ?? null} theme={theme}>
      <TenantThemeProvider theme={theme}>
        <div className="bg-background min-h-screen">
          <div className="container mx-auto max-w-5xl px-4 py-8">
            <Link
              href={`/test-series/${slug}/dashboard`}
              className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center text-sm"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to series
            </Link>

            {/* Hero */}
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {result.scaledScore !== null && result.scaledScoreMax !== null ? (
                      <>
                        <p className="text-muted-foreground text-sm">
                          Total score
                        </p>
                        <h1
                          className={cn(
                            "mt-1 text-3xl font-bold tabular-nums sm:text-4xl",
                            accentClass
                          )}
                        >
                          {result.scaledScore}
                          <span className="text-muted-foreground text-xl font-normal sm:text-2xl">
                            {" "}
                            / {result.scaledScoreMax}
                          </span>
                        </h1>
                        {/* Bluebook reports scaled scores only, no raw marks. */}
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground text-sm">Your score</p>
                        <h1
                          className={cn(
                            "mt-1 text-3xl font-bold tabular-nums sm:text-4xl",
                            accentClass
                          )}
                        >
                          {result.score}
                          <span className="text-muted-foreground text-xl font-normal sm:text-2xl">
                            {" "}
                            / {result.totalMarks}
                          </span>
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {result.percentage.toFixed(1)}%
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {result.correctCount} of {result.totalQuestions} correct
                          </span>
                          {result.wrongCount > 0 && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {result.wrongCount} wrong
                            </span>
                          )}
                          {result.skippedCount > 0 && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {result.skippedCount} skipped
                            </span>
                          )}
                        </p>
                      </>
                    )}
                  </div>
                  {passed !== null && (
                    <Badge
                      variant={passed ? "default" : "destructive"}
                      className="shrink-0 self-start flex items-center gap-1 text-sm"
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      {passed ? "Passed" : "Did not pass"}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Percentile" value={
                    result.percentile !== null
                      ? `${result.percentile.toFixed(1)}%`
                      : "-"
                  } />
                  <Stat
                    label="Rank"
                    value={result.rank !== null ? `#${result.rank}` : "-"}
                  />
                  <Stat
                    label="Predicted rank"
                    value={
                      result.predictedRankMin !== null && result.predictedRankMax !== null
                        ? `${result.predictedRankMin}-${result.predictedRankMax}`
                        : "-"
                    }
                  />
                  <Stat
                    label="Pass criteria"
                    value={
                      result.passCriteriaPct !== null
                        ? `${result.passCriteriaPct}%`
                        : "-"
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pending descriptive-evaluation banner. The shown score reflects
                auto-graded questions only until an evaluator marks the
                descriptive answers, after which the final score updates. */}
            {result.gradingStatus === "PENDING_REVIEW" && (
              <Card className="mt-6 border-amber-200 dark:border-amber-900/50">
                <CardContent className="flex items-start gap-3 p-5">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-foreground font-semibold">
                      Some answers are being evaluated
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {result.pendingMarks ? (
                        <>
                          <span className="font-medium">
                            {result.pendingMarks}
                          </span>{" "}
                          {result.pendingMarks === 1 ? "mark is" : "marks are"}{" "}
                          pending review. The score shown is provisional
                          (auto-graded questions only) and will update once your
                          descriptive answers are marked.
                        </>
                      ) : (
                        <>
                          The score shown is provisional (auto-graded questions
                          only) and will update once your descriptive answers are
                          marked.
                        </>
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Certificate earned */}
            {result.certificate && (
              <Card className="mt-6 border-emerald-200 dark:border-emerald-900/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="text-foreground font-semibold">
                      🎓 Certificate earned
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Certificate no. {result.certificate.certificateNumber}
                    </p>
                  </div>
                  <Link
                    href={`/certificate/${result.certificate.certificateNumber}`}
                    target="_blank"
                  >
                    <Button>View / download certificate</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Certificate pending, grading not finished yet */}
            {!result.certificate && result.certificatePending && (
              <Card className="mt-6 border-amber-200 dark:border-amber-900/50">
                <CardContent className="flex items-center gap-3 p-5">
                  <Clock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-foreground font-semibold">
                      🎓 Certificate pending
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Your certificate will be issued once your descriptive
                      answers have been evaluated.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scholarship */}
            {result.scholarship && (
              <Card className="mt-6 border-amber-200 dark:border-amber-900/50">
                <CardContent className="p-5">
                  <p className="text-foreground font-semibold">
                    🏆 Scholarship: {result.scholarship.name}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Tier <strong>{result.scholarship.tierLabel}</strong>
                    {result.scholarship.amount != null
                      ? ` · ${result.scholarship.currency ?? ""}${result.scholarship.amount}`
                      : ""}
                    {" · "}
                    {result.scholarship.status === "CONFIRMED" ? (
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        Confirmed
                      </span>
                    ) : result.scholarship.status === "REJECTED" ? (
                      <span className="text-muted-foreground">Not awarded</span>
                    ) : (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        Pending review
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Proctoring summary (only when there was monitoring activity) */}
            {result.proctoring && (
              <Card className="mt-6 border-amber-200 dark:border-amber-900/50">
                <CardHeader>
                  <CardTitle className="text-lg">Proctoring summary</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    Activity recorded during this attempt. Your tenant&apos;s
                    reviewers can see this.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      {result.proctoring.tabSwitchCount} tab switch
                      {result.proctoring.tabSwitchCount === 1 ? "" : "es"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-medium">
                      {result.proctoring.flagCount} total event
                      {result.proctoring.flagCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  {result.proctoring.flags.length > 0 && (
                    <ul className="text-muted-foreground max-h-40 space-y-1 overflow-y-auto text-xs">
                      {result.proctoring.flags.slice(0, 50).map((f, i) => (
                        <li key={i} className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {f.type.replace(/_/g, " ").toLowerCase()}
                            {f.detail ? ` (${f.detail})` : ""}
                          </span>
                          {f.at && (
                            <span className="tabular-nums">
                              {new Date(f.at).toLocaleTimeString()}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Previous attempts (re-attempt history) */}
            <TestAttemptHistory
              slug={slug}
              testId={testId}
              currentAttemptId={attemptId}
            />

            {/* Adaptive path (MST) */}
            {result.adaptive && result.adaptive.sections.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">Your adaptive path</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    Module 1 performance decided which module 2 you received.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.adaptive.sections.map((sec) => (
                    <div key={sec.sectionId} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-foreground font-medium">
                          {sec.sectionName}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            Routing
                            {sec.path
                              ? ` → ${sec.path
                                  .split(">")
                                  .map(
                                    (v) => v.charAt(0) + v.slice(1).toLowerCase()
                                  )
                                  .join(" → ")}`
                              : ""}
                          </Badge>
                          {sec.scaledScore !== null && sec.scaleMax !== null && (
                            <span className="text-foreground text-sm font-semibold tabular-nums">
                              {sec.scaledScore} / {sec.scaleMax}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {sec.modules.map((m) => (
                          <div key={m.attemptModuleId}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {m.label} ·{" "}
                                {m.stageNo === 1
                                  ? "Routing"
                                  : m.variant.charAt(0) +
                                    m.variant.slice(1).toLowerCase()}
                                {m.autoCompleted ? " · auto-submitted" : ""}
                              </span>
                              <span className="text-foreground tabular-nums">
                                {m.rawCorrect} correct · {m.answeredCount}/
                                {m.questionCount} answered
                              </span>
                            </div>
                            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                              <div
                                className="bg-primary h-full transition-all"
                                style={{
                                  width: `${
                                    m.questionCount > 0
                                      ? Math.min(
                                          100,
                                          (m.rawCorrect / m.questionCount) * 100
                                        )
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {sec.coaching &&
                        sec.coaching.gap !== null &&
                        sec.coaching.gap > 0 && (
                          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                            You answered {sec.coaching.module1Correct} of{" "}
                            {sec.coaching.module1Total} in Module 1.{" "}
                            <span className="font-semibold">
                              {sec.coaching.gap} more correct
                            </span>{" "}
                            would have unlocked the harder module.
                            {sec.scaleMax !== null &&
                              sec.sectionCeilingMax !== null &&
                              sec.sectionCeilingMax > sec.scaleMax && (
                                <>
                                  {" "}
                                  This path caps at {sec.scaleMax}; the top path
                                  reaches {sec.sectionCeilingMax}.
                                </>
                              )}
                          </div>
                        )}
                      {sec.coaching?.reachedHardest && (
                        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                          You reached the hardest module in this section.
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Section breakdown */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Section-wise breakdown</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-muted-foreground text-xs uppercase">
                    <tr className="border-b">
                      <th className="py-2 pr-4 text-left font-medium">Section</th>
                      <th className="py-2 px-2 text-right font-medium">Attempted</th>
                      <th className="py-2 px-2 text-right font-medium">Correct</th>
                      <th className="py-2 px-2 text-right font-medium">Wrong</th>
                      <th className="py-2 px-2 text-right font-medium">Skipped</th>
                      <th className="py-2 px-2 text-right font-medium">Marks</th>
                      <th className="py-2 px-2 text-right font-medium">Accuracy</th>
                      <th className="py-2 pl-2 text-right font-medium">Avg time/Q</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.sectionBreakdown.map((s) => (
                      <tr key={s.sectionId} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 font-medium">{s.sectionName}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{s.attempted}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-green-600">
                          {s.correct}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-red-600">
                          {s.wrong}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                          {s.skipped}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{s.marks}</td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {s.accuracyPct.toFixed(1)}%
                        </td>
                        <td className="py-2 pl-2 text-right tabular-nums">
                          {fmtTime(s.avgTimePerQuestionSec)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Topic breakdown */}
            {result.topicBreakdown.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">Topic-wise accuracy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.topicBreakdown.map((t) => (
                      <div key={t.topic}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-foreground font-medium">
                            {t.topic}
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {t.correctPct.toFixed(0)}% · {t.total} Q
                          </span>
                        </div>
                        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full transition-all"
                            style={{ width: `${Math.min(100, t.correctPct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Advanced analytics */}
            {result.analytics && (
              <AdvancedAnalyticsSection analytics={result.analytics} />
            )}

            {/* Question review */}
            <Card className="mt-6">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-lg">Question review</CardTitle>
                  <div className="flex flex-wrap gap-1">
                    {(["all", "correct", "wrong", "skipped"] as const).map((f) => (
                      <Button
                        key={f}
                        variant={filter === f ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(f)}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredQuestions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No questions match this filter.</p>
                ) : (
                  <ol className="space-y-4">
                    {filteredQuestions.map((q, idx) => (
                      <QuestionReview
                        key={q.questionId}
                        q={q}
                        index={questionNumber.get(q.questionId) ?? idx + 1}
                      />
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download PDF
              </Button>
              <Link href={`/test-series/${slug}/dashboard`}>
                <Button variant="outline">Back to series</Button>
              </Link>
            </div>
          </div>
        </div>
      </TenantThemeProvider>
    </LayoutWrapper>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-md p-3">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground mt-1 text-lg font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function QuestionReview({ q, index }: { q: ResultQuestion; index: number }) {
  // Descriptive answer still awaiting a human evaluator. Suppress the
  // correct/incorrect treatment and show a neutral "pending" state instead.
  const pendingReview = q.pendingReview === true;
  // Descriptive answer that has been marked by an evaluator (no right/wrong.
  // it carries awarded marks + optional feedback instead).
  const gradedDescriptive = q.type === "DESCRIPTIVE" && !pendingReview;

  const Icon = pendingReview
    ? Clock
    : gradedDescriptive
      ? CheckCircle2
      : q.isCorrect === true
        ? CheckCircle2
        : q.isCorrect === false
          ? XCircle
          : MinusCircle;
  const color = pendingReview
    ? "text-amber-600 dark:text-amber-400"
    : gradedDescriptive
      ? "text-indigo-600 dark:text-indigo-400"
      : q.isCorrect === true
        ? "text-green-600"
        : q.isCorrect === false
          ? "text-red-600"
          : "text-muted-foreground";

  // DRAG_DROP answers are stored as option ids; show the option label in review
  // so the student sees the actual chosen/correct option text, not a bare id.
  const isDragDrop = q.type === "DRAG_DROP";
  const yourAnswerDisplay = isDragDrop
    ? resolveOptionLabels(q.yourAnswer, q.options)
    : q.yourAnswer;
  const correctAnswerDisplay = isDragDrop
    ? resolveOptionLabels(q.correctAnswer, q.options)
    : q.correctAnswer;

  // Multi-blank drag-drop: the correct answer is an ordered array (one option
  // per blank, in stem order). Show a per-blank breakdown so "Blank N" numbering
  // is preserved and it's obvious which blank was wrong, the flat option list
  // below marks an option "correct" if it appears anywhere, which makes a
  // swapped-blank answer look entirely correct even when it isn't.
  const dragCorrectArr =
    isDragDrop && Array.isArray(q.correctAnswer)
      ? (q.correctAnswer as unknown[])
      : null;
  const isMultiBlank = dragCorrectArr !== null && dragCorrectArr.length > 1;
  const dragYourArr = Array.isArray(q.yourAnswer)
    ? (q.yourAnswer as unknown[])
    : [];
  const dragLabelMap = isDragDrop ? getOptionLabelMap(q.options) : {};

  // Fill the blanks in place, the way the paper looked while being sat. Tried
  // for every drag-and-drop question, not just multi-blank ones: a single-blank
  // question stores its answer as a bare value rather than an array, and gating
  // on the array shape left those rendering as a bare option list.
  // Returns null when the stem's blanks cannot be aligned to the answers, in
  // which case the lists below are shown instead.
  const dragAlignment = isDragDrop
    ? alignDragDropAnswers(q.stem, q.yourAnswer, q.correctAnswer, dragLabelMap)
    : null;
  const dragStemImageUrl = dragAlignment ? getStemImageUrl(q.stem) : null;

  return (
    <li className="border-border bg-muted/20 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", color)} />
        <div className="flex-1 min-w-0">
          <p className="text-muted-foreground text-xs">
            Q{index} · {q.type.replace(/_/g, " ")} ·{" "}
            {q.isPretest ? (
              <span className="font-medium text-amber-600">
                Unscored (pilot question)
              </span>
            ) : pendingReview ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <Clock className="h-3 w-3" />
                Pending evaluation
              </span>
            ) : gradedDescriptive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                <CheckCircle2 className="h-3 w-3" />
                Evaluated · {q.marksAwarded}{" "}
                {q.marksAwarded === 1 ? "mark" : "marks"}
              </span>
            ) : q.isCorrect === true ? (
              <span className="font-medium text-green-600">Correct</span>
            ) : q.isCorrect === false ? (
              <span className="font-medium text-red-600">Incorrect</span>
            ) : (
              <span className="text-muted-foreground">Not answered</span>
            )}{" "}
            · {fmtTime(q.timeSpentSec)}
          </p>
          <div className="text-foreground mt-2 text-sm">
            {dragAlignment ? (
              <>
                <DragDropFilledStem alignment={dragAlignment} />
                {/* Rendering the stem ourselves means carrying its diagram
                    across too, or a question with one would lose it. */}
                {dragStemImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dragStemImageUrl}
                    alt="Question diagram"
                    className="border-border mt-2 block h-auto w-auto max-h-72 max-w-md rounded border object-contain"
                  />
                )}
              </>
            ) : (
              renderUnknown(q.stem)
            )}
          </div>

          {isMultiBlank && !dragAlignment && (
            <div className="mt-3 space-y-2">
              {dragCorrectArr!.map((correctId, i) => {
                const yourId = dragYourArr[i];
                const hasYour = yourId != null && String(yourId).trim() !== "";
                const blankOk =
                  hasYour &&
                  String(yourId).trim() === String(correctId).trim();
                const yourLabel = hasYour
                  ? dragLabelMap[String(yourId)] ?? String(yourId)
                  : "Not answered";
                const correctLabel =
                  dragLabelMap[String(correctId)] ?? String(correctId);
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm",
                      blankOk
                        ? "border-green-600/40 bg-green-50 dark:bg-green-950/20"
                        : "border-red-600/40 bg-red-50 dark:bg-red-950/20"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="bg-muted text-foreground shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold">
                        Blank {i + 1}
                      </span>
                      {blankOk ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                      )}
                    </div>
                    <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      <div className="min-w-0">
                        <span className="text-muted-foreground text-xs">
                          Your answer:{" "}
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            blankOk
                              ? "text-green-800 dark:text-green-100"
                              : "text-red-800 dark:text-red-200"
                          )}
                        >
                          <MathText block={false}>{yourLabel}</MathText>
                        </span>
                      </div>
                      {!blankOk && (
                        <div className="min-w-0">
                          <span className="text-muted-foreground text-xs">
                            Correct:{" "}
                          </span>
                          <span className="font-medium text-green-800 dark:text-green-100">
                            <MathText block={false}>{correctLabel}</MathText>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* The filled-in stem already names the chosen and correct token, so
              repeating the option list under it is noise. */}
          {!isMultiBlank &&
            !dragAlignment &&
            Array.isArray(q.options) &&
            q.options.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {(q.options as unknown[]).map((opt, i) => {
                const o = (opt ?? {}) as Record<string, unknown>;
                const id = (o.id as string | undefined) ?? String(i);
                const label =
                  (o.label as string | undefined) ??
                  (o.text as string | undefined) ??
                  id;
                const isCorrect =
                  o.is_correct === true ||
                  answerRefersTo(q.correctAnswer, id, label);
                const isChosen = answerRefersTo(q.yourAnswer, id, label);
                // When the test withholds solutions, `correctAnswer` is null
                // and no option can be identified as correct, so the option
                // the learner picked was painted RED and labelled "Your answer"
                // even on a question the header had just marked Correct.
                //
                // The per-question verdict IS known (it drives that header), so
                // use it: a chosen option on a correct answer is green. This
                // does not reveal anything withheld, on a wrong answer the
                // right option stays hidden, exactly as the setting intends.
                const chosenIsRight = isChosen && q.isCorrect === true;
                return (
                  <li
                    key={id}
                    className={cn(
                      "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
                      isCorrect || chosenIsRight
                        ? "border-green-600/40 bg-green-50 dark:bg-green-950/20"
                        : isChosen
                          ? "border-red-600/40 bg-red-50 dark:bg-red-950/20"
                          : "border-border bg-background"
                    )}
                  >
                    <span className="text-muted-foreground mt-0.5 shrink-0 font-semibold">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <MathText block={false}>{label}</MathText>
                    </div>
                    {isCorrect && (
                      <span className="shrink-0 text-xs font-medium text-green-700 dark:text-green-300">
                        Correct
                      </span>
                    )}
                    {isChosen && !isCorrect && !chosenIsRight && (
                      <span className="shrink-0 text-xs font-medium text-red-700 dark:text-red-300">
                        Your answer
                      </span>
                    )}
                    {isChosen && (isCorrect || chosenIsRight) && (
                      <span className="shrink-0 text-xs font-medium text-green-700 dark:text-green-300">
                        Your answer
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {!(Array.isArray(q.options) && q.options.length > 0) && (
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="bg-background rounded-md p-3">
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Your answer
                </p>
                <div className="text-foreground mt-1">
                  {renderUnknown(yourAnswerDisplay)}
                </div>
              </div>
              {q.correctAnswer !== null && (
                <div className="rounded-md border border-green-600/40 bg-green-50 p-3 dark:bg-green-950/20">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-300">
                    Correct answer
                  </p>
                  <div className="mt-1 text-green-800 dark:text-green-100">
                    {q.type === "NAT"
                      ? formatNatAnswer(q.correctAnswer)
                      : renderUnknown(correctAnswerDisplay)}
                  </div>
                </div>
              )}
            </div>
          )}

          {q.explanation && (
            <div className="bg-background mt-3 rounded-md p-3 text-sm">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Explanation
              </p>
              <div className="text-foreground mt-1 leading-relaxed">
                <MathText multiline>{q.explanation}</MathText>
              </div>
            </div>
          )}

          {q.type === "DESCRIPTIVE" && q.graderRemarks && (
            <div className="mt-3 rounded-md border border-indigo-600/40 bg-indigo-50 p-3 text-sm dark:bg-indigo-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                Feedback from evaluator
              </p>
              <div className="mt-1 leading-relaxed text-indigo-900 dark:text-indigo-100">
                <MathText multiline>{q.graderRemarks}</MathText>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function AdvancedAnalyticsSection({
  analytics,
}: {
  analytics: import("@/lib/api/test-series").AdvancedAnalytics;
}) {
  // Group strengthHeatmap by topic for the row-based grid
  const topics = Array.from(
    new Set(analytics.strengthHeatmap.map((c) => c.topic))
  );
  const difficulties: Array<"EASY" | "MEDIUM" | "HARD"> = ["EASY", "MEDIUM", "HARD"];

  function cellFor(topic: string, diff: "EASY" | "MEDIUM" | "HARD") {
    return analytics.strengthHeatmap.find(
      (c) => c.topic === topic && c.difficulty === diff
    );
  }

  function pctColor(pct: number | undefined): string {
    if (pct === undefined) return "bg-muted/30 text-muted-foreground";
    if (pct >= 80) return "bg-green-500/20 text-green-700 dark:text-green-200";
    if (pct >= 50) return "bg-amber-500/20 text-amber-700 dark:text-amber-200";
    if (pct > 0) return "bg-red-500/20 text-red-700 dark:text-red-200";
    return "bg-muted/40 text-muted-foreground";
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Advanced analytics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Composite scores */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Exam readiness" value={`${analytics.examReadiness}/100`} />
          <Stat label="Time efficiency" value={`${analytics.timeEfficiency}/100`} />
          <Stat label="Consistency" value={`${analytics.consistency}/100`} />
          <Stat
            label="Top 10% avg"
            value={
              analytics.topPercentileAvgScore !== null
                ? String(analytics.topPercentileAvgScore)
                : "-"
            }
          />
        </div>

        {/* How these are calculated, so the numbers are not a mystery. */}
        <div className="bg-muted/40 text-muted-foreground space-y-1 rounded-lg p-3 text-xs leading-relaxed">
          <p>
            <span className="text-foreground font-medium">Exam readiness</span>{" "}
            combines accuracy (50%), time efficiency (25%) and consistency (25%),
            so a perfect score alone does not reach 100 unless timing and
            consistency are also strong.
          </p>
          <p>
            <span className="text-foreground font-medium">Time efficiency</span>{" "}
            reflects how well your time per question matched the time available.
          </p>
          <p>
            <span className="text-foreground font-medium">Consistency</span>{" "}
            measures how steady your scores are across your attempts in this
            series.
          </p>
          <p>
            <span className="text-foreground font-medium">Top 10% avg</span> is
            the average score of the top 10% of learners on this test.
          </p>
        </div>

        {/* Strength heatmap */}
        {topics.length > 0 && (
          <div>
            <p className="text-foreground mb-2 text-sm font-semibold">
              Topic × difficulty heatmap
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-muted-foreground py-1 pr-3 text-left text-xs font-medium">
                      Topic
                    </th>
                    {difficulties.map((d) => (
                      <th
                        key={d}
                        className="text-muted-foreground px-2 py-1 text-center text-xs font-medium uppercase"
                      >
                        {d.toLowerCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topics.map((topic) => (
                    <tr key={topic} className="border-t">
                      <td className="text-foreground py-1.5 pr-3 font-medium">
                        {topic}
                      </td>
                      {difficulties.map((d) => {
                        const cell = cellFor(topic, d);
                        return (
                          <td key={d} className="px-1.5 py-1.5 text-center">
                            <div
                              className={cn(
                                "rounded-md px-2 py-1 text-xs font-medium tabular-nums",
                                pctColor(cell?.pct)
                              )}
                            >
                              {cell ? `${cell.pct.toFixed(0)}%` : "-"}
                              {cell && (
                                <span className="ml-1 opacity-70">
                                  ({cell.correct}/{cell.total})
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {analytics.recommendations.length > 0 && (
          <div>
            <p className="text-foreground mb-2 text-sm font-semibold">
              Recommended next steps
            </p>
            <ul className="space-y-1.5 text-sm">
              {analytics.recommendations.map((r, i) => (
                <li key={i} className="text-muted-foreground flex items-start gap-2">
                  <span className="bg-primary/15 text-primary mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                    {i + 1}
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
