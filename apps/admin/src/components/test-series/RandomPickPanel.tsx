"use client";

import { Badge, Button, cn, Input, Label, useToast } from "@open-mtlms/core";
import { AlertTriangle, Loader2, RotateCcw, Shuffle, X } from "lucide-react";
import { useEffect, useState } from "react";

import { MathText } from "@/components/test-series/MathText";
import type { RandomPickSummary, TestQuestion } from "@/lib/api/test-series";
import {
  useRandomPickQuestions,
  useTestQuestionBanks,
} from "@/lib/hooks/use-test-series";
import {
  answerSummary,
  correctIdSet,
  optionParts,
  stemParts,
} from "@/lib/utils/test-question-render";

const COUNT_PILLS = [10, 15, 20, 30];
const MAX_COUNT = 200;

interface RandomPickPanelProps {
  /** Question ids already selected/attached anywhere; never picked again. */
  excludeIds: string[];
  /** Receives the questions the user reviewed and confirmed. */
  onPicked: (questions: TestQuestion[], summary: RandomPickSummary) => void;
}

/** One reviewable picked question with an expandable options/answer view. */
function ReviewRow({
  index,
  q,
  onRemove,
}: {
  index: number;
  q: TestQuestion;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { text, imageUrl: stemImageUrl } = stemParts(q.stem);
  const options = optionParts(q.options);
  const correct = correctIdSet(q.correctAnswer);

  return (
    <li className="rounded-md border p-2">
      <div className="flex items-start gap-2">
        <span className="text-muted-foreground w-5 shrink-0 text-xs">{index + 1}</span>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {q.difficulty}
        </Badge>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5 text-sm">
            {stemImageUrl && (
              <img
                src={stemImageUrl}
                alt=""
                className="mt-0.5 h-8 w-auto max-w-[80px] shrink-0 rounded border object-contain"
              />
            )}
            {text ? (
              <MathText block={false}>{text}</MathText>
            ) : (
              !stemImageUrl && <span>(empty stem)</span>
            )}
          </div>
          {open && (
            <div className="mt-1.5 space-y-1 border-t pt-1.5">
              {options.length > 0 ? (
                options.map((o) => {
                  const isCorrect = correct.has(o.id.toUpperCase());
                  return (
                    <div
                      key={o.id}
                      className={cn(
                        "flex items-start gap-1 text-xs",
                        isCorrect ? "text-emerald-600" : "text-muted-foreground",
                      )}
                    >
                      <span className="font-medium">{o.id}.</span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        {o.imageUrl && (
                          <img
                            src={o.imageUrl}
                            alt=""
                            className="h-7 w-auto max-w-[64px] shrink-0 rounded border object-contain"
                          />
                        )}
                        {o.label ? (
                          <MathText block={false}>{o.label}</MathText>
                        ) : (
                          !o.imageUrl && <span>(empty)</span>
                        )}
                      </span>
                      {isCorrect && <span className="font-medium">✓</span>}
                    </div>
                  );
                })
              ) : (
                <p className="text-muted-foreground text-xs">
                  Answer: {answerSummary(q.options, q.correctAnswer)}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground mt-1 text-[11px] underline"
          >
            {open ? "Hide options & answer" : "Show options & answer"}
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          title="Remove this question from the pick"
          className="text-muted-foreground hover:text-destructive shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

/**
 * Authoring-time "Random pick": choose banks + how many questions + a
 * difficulty mix, the backend returns a random PUBLISHED selection, and the
 * educator REVIEWS the exact questions (remove any, re-pick) before confirming.
 * Distinct from a test's `random_question_count`, which randomises per attempt.
 */
export function RandomPickPanel({ excludeIds, onPicked }: RandomPickPanelProps) {
  const { toast } = useToast();
  const { data: banksData, isLoading: loadingBanks } = useTestQuestionBanks({
    limit: 100,
  });
  const banks = banksData?.banks ?? [];

  const [selectedBanks, setSelectedBanks] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(10);
  const [easy, setEasy] = useState(50);
  const [medium, setMedium] = useState(35);
  const [hard, setHard] = useState(15);
  const [lastSummary, setLastSummary] = useState<RandomPickSummary | null>(null);
  // Picked-but-not-yet-confirmed questions under review.
  const [picked, setPicked] = useState<TestQuestion[] | null>(null);

  const pickMut = useRandomPickQuestions();

  useEffect(() => {
    if (banks.length === 1) {
      setSelectedBanks((prev) => (prev.size === 0 ? new Set([banks[0].id]) : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banks.length]);

  const toggleBank = (id: string) => {
    setSelectedBanks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mixSum = easy + medium + hard;
  const mixValid = mixSum === 100;
  const countValid = Number.isInteger(count) && count >= 1 && count <= MAX_COUNT;
  const canPick =
    selectedBanks.size > 0 && mixValid && countValid && !pickMut.isPending;

  const handlePick = () => {
    pickMut.mutate(
      {
        question_bank_ids: Array.from(selectedBanks),
        count,
        distribution: { easy, medium, hard },
        exclude_question_ids: excludeIds,
      },
      {
        onSuccess: (res) => {
          setLastSummary(res.summary);
          setPicked(res.questions);
        },
        onError: (err) =>
          toast({
            title: "Random pick failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  const removeOne = (id: string) =>
    setPicked((prev) => (prev ? prev.filter((q) => q.id !== id) : prev));

  const confirmAdd = () => {
    if (!picked || picked.length === 0 || !lastSummary) return;
    onPicked(picked, lastSummary);
    setPicked(null);
  };

  const mixDiffers =
    lastSummary !== null &&
    (lastSummary.picked.easy !== lastSummary.requested.easy ||
      lastSummary.picked.medium !== lastSummary.requested.medium ||
      lastSummary.picked.hard !== lastSummary.requested.hard);

  // ── Review stage ─────────────────────────────────────────────────────────
  if (picked !== null) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">
            Review picked questions ({picked.length})
          </Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPicked(null)}
            title="Discard this selection and change the settings"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Re-pick
          </Button>
        </div>

        {lastSummary && (mixDiffers || lastSummary.shortfall > 0) && (
          <div className="space-y-1 rounded-md border bg-muted/20 p-2 text-xs">
            {mixDiffers && lastSummary.shortfall === 0 && (
              <p className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Actual mix differs from the request; backfilled from other
                difficulties.
              </p>
            )}
            {lastSummary.shortfall > 0 && (
              <p className="text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {lastSummary.shortfall} short: not enough published questions in
                the selected banks.
              </p>
            )}
          </div>
        )}

        {picked.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            You removed every question. Re-pick to choose again.
          </p>
        ) : (
          <ol className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {picked.map((q, idx) => (
              <ReviewRow
                key={q.id}
                index={idx}
                q={q}
                onRemove={() => removeOne(q.id)}
              />
            ))}
          </ol>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Review each question, remove any you don&apos;t want, then add them.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={confirmAdd}
            disabled={picked.length === 0}
          >
            Add {picked.length} question{picked.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Configure stage ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Question banks</Label>
        {loadingBanks ? (
          <div className="flex justify-center py-4">
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          </div>
        ) : banks.length === 0 ? (
          <p className="text-muted-foreground py-2 text-xs">
            No question banks yet. Create one first.
          </p>
        ) : (
          <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-2">
            {banks.map((b) => {
              const checked = selectedBanks.has(b.id);
              return (
                <label
                  key={b.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm",
                    checked ? "bg-primary/5" : "hover:bg-muted/40"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBank(b.id)}
                    className="h-4 w-4"
                  />
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                </label>
              );
            })}
          </div>
        )}
        <p className="text-muted-foreground text-xs">
          {selectedBanks.size} bank{selectedBanks.size === 1 ? "" : "s"} selected
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">How many questions</Label>
        <div className="flex flex-wrap items-center gap-2">
          {COUNT_PILLS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={cn(
                "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                count === n
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input text-muted-foreground hover:bg-muted/40"
              )}
            >
              {n}
            </button>
          ))}
          <Input
            type="number"
            min={1}
            max={MAX_COUNT}
            value={String(count)}
            onChange={(e) => setCount(parseInt(e.target.value || "0", 10))}
            className="h-8 w-20"
            aria-label="Custom question count"
          />
        </div>
        {!countValid && (
          <p className="text-destructive text-xs">
            Count must be between 1 and {MAX_COUNT}.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Difficulty mix (must sum to 100)</Label>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Easy %</p>
            <Input
              type="number"
              min={0}
              max={100}
              value={String(easy)}
              onChange={(e) => setEasy(parseInt(e.target.value || "0", 10))}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Medium %</p>
            <Input
              type="number"
              min={0}
              max={100}
              value={String(medium)}
              onChange={(e) => setMedium(parseInt(e.target.value || "0", 10))}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Hard %</p>
            <Input
              type="number"
              min={0}
              max={100}
              value={String(hard)}
              onChange={(e) => setHard(parseInt(e.target.value || "0", 10))}
              className="h-8"
            />
          </div>
        </div>
        <p
          className={cn(
            "text-xs",
            mixValid ? "text-muted-foreground" : "text-destructive"
          )}
        >
          Sum: {Number.isFinite(mixSum) ? mixSum : 0}%
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={!canPick}
        onClick={handlePick}
        className="w-full"
      >
        {pickMut.isPending ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Picking...
          </>
        ) : (
          <>
            <Shuffle className="mr-1.5 h-3.5 w-3.5" />
            Pick {countValid ? count : ""} questions
          </>
        )}
      </Button>
      <p className="text-muted-foreground text-xs">
        You&apos;ll review the exact questions before they&apos;re added.
      </p>
    </div>
  );
}
