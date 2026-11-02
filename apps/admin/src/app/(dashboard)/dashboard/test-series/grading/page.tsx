"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PenLine,
  User,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { MathText } from "@/components/test-series/MathText";
import type {
  GradingAnswer,
  PendingGradingAttempt,
} from "@/lib/api/test-series";
import {
  useGradeAnswer,
  useGradingAttempt,
  usePendingGrading,
} from "@/lib/hooks/use-test-series";
import { decodeEntities } from "@/lib/quiz-formats/text";
import { cn } from "@/lib/utils";

/** Pull the human-readable stem text out of the unknown-typed `stem` field. */
function stemText(stem: unknown): string {
  if (typeof stem === "string") return decodeEntities(stem);
  if (typeof stem === "object" && stem !== null) {
    const o = stem as Record<string, unknown>;
    if (typeof o.text === "string") return decodeEntities(o.text);
    if (typeof o.html === "string")
      return decodeEntities(o.html.replace(/<[^>]+>/g, ""));
  }
  return "";
}

/** Student answer may be a plain string, `{ text }`, or null. */
function answerText(answer: unknown): string {
  if (typeof answer === "string") return answer;
  if (typeof answer === "object" && answer !== null) {
    const o = answer as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
  }
  return "";
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "string" ? parseFloat(v) || 0 : v;
}

// ---------------------------------------------------------------------------
// Queue view
// ---------------------------------------------------------------------------
function QueueRow({
  attempt,
  onOpen,
}: {
  attempt: PendingGradingAttempt;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hover:bg-muted/50 flex w-full items-center justify-between gap-4 rounded-lg border p-4 text-left transition-colors"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <User className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="text-foreground truncate font-medium">
            {attempt.learner_name || "Learner"}
          </span>
          {attempt.learner_email && (
            <span className="text-muted-foreground truncate text-xs">
              {attempt.learner_email}
            </span>
          )}
        </div>
        <p className="text-muted-foreground truncate text-sm">
          {attempt.test_name}
          {attempt.series_title ? ` · ${attempt.series_title}` : ""}
        </p>
        <p className="text-muted-foreground text-xs">
          Submitted {formatDateTime(attempt.submitted_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Badge variant="secondary" className="whitespace-nowrap">
          {attempt.pending_count} to grade
        </Badge>
      </div>
    </button>
  );
}

function GradingQueue({ onOpen }: { onOpen: (attemptId: string) => void }) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = usePendingGrading({ limit: 100 });

  const attempts = useMemo(() => {
    const rows = data?.attempts ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (a) =>
        a.learner_name?.toLowerCase().includes(q) ||
        a.learner_email?.toLowerCase().includes(q) ||
        a.test_name?.toLowerCase().includes(q) ||
        a.series_title?.toLowerCase().includes(q)
    );
  }, [data?.attempts, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by learner, test, or series…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 p-8 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pending attempts…
        </div>
      ) : attempts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex h-12 w-12 items-center justify-center rounded-full">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-foreground font-medium">All caught up</p>
              <p className="text-muted-foreground text-sm">
                {search
                  ? "No attempts match your search."
                  : "No descriptive answers are waiting to be graded."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {attempts.map((a) => (
            <QueueRow
              key={a.attempt_id}
              attempt={a}
              onOpen={() => onOpen(a.attempt_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grading detail view
// ---------------------------------------------------------------------------
function AnswerCard({ answer }: { answer: GradingAnswer }) {
  const { toast } = useToast();
  const gradeMut = useGradeAnswer();
  const maxMarks = toNum(answer.marks);
  const isGraded = answer.grading_status === "MANUALLY_GRADED";

  const [marks, setMarks] = useState<string>(
    answer.marks_awarded != null ? String(toNum(answer.marks_awarded)) : ""
  );
  const [remarks, setRemarks] = useState<string>(answer.grader_remarks ?? "");

  const student = answerText(answer.answer).trim();
  const question = stemText(answer.stem).trim();

  const handleSave = () => {
    const awarded = parseFloat(marks);
    if (!Number.isFinite(awarded) || awarded < 0 || awarded > maxMarks) {
      toast({
        title: "Invalid marks",
        description: `Enter a value between 0 and ${maxMarks}.`,
        variant: "destructive",
      });
      return;
    }
    gradeMut.mutate(
      {
        answerId: answer.answer_id,
        data: { marksAwarded: awarded, remarks: remarks.trim() || undefined },
      },
      {
        onSuccess: () => {
          toast({ title: "Answer graded" });
        },
        onError: (err) =>
          toast({
            title: "Grading failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <Card className={cn(isGraded && "border-emerald-500/40")}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Question
            </p>
            <div className="text-foreground text-sm">
              {question ? (
                <MathText>{question}</MathText>
              ) : (
                <span className="text-muted-foreground italic">
                  (no question text)
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline" className="whitespace-nowrap">
              {maxMarks} mark{maxMarks === 1 ? "" : "s"}
            </Badge>
            {isGraded && (
              <Badge className="whitespace-nowrap bg-emerald-600 hover:bg-emerald-600">
                {toNum(answer.marks_awarded)} / {maxMarks}
              </Badge>
            )}
          </div>
        </div>

        {answer.explanation && (
          <div className="bg-muted/40 space-y-1 rounded-md border p-3">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Model answer / grading notes
            </p>
            <div className="text-foreground text-sm">
              <MathText>{decodeEntities(answer.explanation)}</MathText>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Student answer
          </p>
          {student ? (
            <p className="text-foreground whitespace-pre-wrap text-sm">
              {student}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm italic">No answer</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[9rem_1fr] sm:items-start">
          <div className="space-y-1">
            <Label>Marks awarded</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={maxMarks}
                step="0.5"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                className="w-24"
              />
              <span className="text-muted-foreground text-sm">
                / {maxMarks}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Remarks (optional)</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Feedback for the learner…"
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={gradeMut.isPending}
          >
            {gradeMut.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isGraded ? "Update grade" : "Save grade"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function GradingDetail({
  attemptId,
  onBack,
}: {
  attemptId: string;
  onBack: () => void;
}) {
  const { data, isLoading } = useGradingAttempt(attemptId);

  const attempt = data?.attempt;
  const answers = data?.answers ?? [];
  const gradedCount = answers.filter(
    (a) => a.grading_status === "MANUALLY_GRADED"
  ).length;
  const allGraded = answers.length > 0 && gradedCount === answers.length;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to queue
      </Button>

      {isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 p-8 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading attempt…
        </div>
      ) : !attempt ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground text-sm">
              This attempt could not be loaded.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{attempt.test_name}</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    <span className="text-foreground font-medium">
                      {attempt.learner_name || "Learner"}
                    </span>
                    {attempt.learner_email ? ` · ${attempt.learner_email}` : ""}
                    {attempt.series_title ? ` · ${attempt.series_title}` : ""}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Submitted {formatDateTime(attempt.submitted_at)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge
                    variant={allGraded ? "default" : "secondary"}
                    className={cn(
                      "whitespace-nowrap",
                      allGraded && "bg-emerald-600 hover:bg-emerald-600"
                    )}
                  >
                    {allGraded
                      ? "Completed"
                      : `${gradedCount}/${answers.length} graded`}
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    Score: {toNum(attempt.score)}
                    {attempt.total_marks != null
                      ? ` / ${toNum(attempt.total_marks)}`
                      : ""}
                  </span>
                </div>
              </div>
            </CardHeader>
          </Card>

          {answers.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground text-sm">
                  No descriptive answers on this attempt.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {answers.map((a) => (
                <AnswerCard key={a.answer_id} answer={a} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function TestGradingPage() {
  const [attemptId, setAttemptId] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/test-series"
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Test Series
            </Link>
            <span className="text-muted-foreground text-sm">/</span>
            <span className="text-foreground text-sm font-medium">Grading</span>
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <PenLine className="text-primary h-6 w-6" />
            Descriptive Grading
          </h1>
          <p className="text-muted-foreground text-sm">
            {attemptId
              ? "Award marks and leave remarks for each descriptive answer."
              : "Attempts with descriptive answers waiting to be graded."}
          </p>
        </div>
        {!attemptId && (
          <div className="text-muted-foreground hidden items-center gap-2 text-sm sm:flex">
            <ClipboardList className="h-4 w-4" />
            Evaluation queue
          </div>
        )}
      </div>

      {attemptId ? (
        <GradingDetail
          attemptId={attemptId}
          onBack={() => setAttemptId(null)}
        />
      ) : (
        <GradingQueue onOpen={setAttemptId} />
      )}
    </div>
  );
}
