"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@open-mtlms/core";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MathText } from "@/components/test-series/MathText";
import { testQuestionsApi, type TestQuestion } from "@/lib/api/test-series";
import { useQuestionHealth } from "@/lib/hooks/use-test-series";

function stemPreview(stem: unknown): string {
  if (typeof stem === "string") return stem;
  if (stem && typeof stem === "object" && "text" in stem) {
    return String((stem as { text?: unknown }).text ?? "");
  }
  try {
    return JSON.stringify(stem).slice(0, 120);
  } catch {
    return "";
  }
}

/**
 * Classical test theory health per question: p-value (proportion correct),
 * point-biserial discrimination, average time, and actionable flags. The
 * feedback loop for keeping pools honest: relabel drifted difficulties and
 * retire negative-discrimination items (usually a wrong answer key).
 */
export function QuestionHealthDialog({
  bankId,
  open,
  onOpenChange,
}: {
  bankId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuestionHealth(
    bankId,
    { page, limit: 20 },
    { enabled: open }
  );
  const [questionsById, setQuestionsById] = useState<Map<string, TestQuestion>>(
    new Map()
  );

  const ids = useMemo(
    () => (data?.questions ?? []).map((q) => q.questionId),
    [data]
  );
  useEffect(() => {
    if (!open || ids.length === 0) return;
    let cancelled = false;
    testQuestionsApi.getByIds(ids).then((rows) => {
      if (cancelled) return;
      setQuestionsById(new Map(rows.map((r) => [r.id, r])));
    });
    return () => {
      cancelled = true;
    };
  }, [open, ids]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Question health</DialogTitle>
          <DialogDescription>
            Live stats from submitted attempts: p-value (share answered
            correctly), discrimination (do strong students get it right more
            often), and suggested difficulty relabels.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto px-6">
          {isLoading ? (
            <div className="space-y-2 py-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-muted h-12 w-full animate-pulse rounded-md" />
              ))}
            </div>
          ) : (data?.questions ?? []).length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No questions in this bank.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-card text-muted-foreground sticky top-0 text-xs uppercase">
                <tr className="border-b">
                  <th className="py-2 pr-3 text-left font-medium">Question</th>
                  <th className="px-2 py-2 text-right font-medium">Attempts</th>
                  <th className="px-2 py-2 text-right font-medium">p-value</th>
                  <th className="px-2 py-2 text-right font-medium">Discrimination</th>
                  <th className="px-2 py-2 text-right font-medium">Avg time</th>
                  <th className="py-2 pl-2 text-left font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {(data?.questions ?? []).map((entry) => {
                  const q = questionsById.get(entry.questionId);
                  return (
                    <tr key={entry.questionId} className="border-b align-top last:border-b-0">
                      <td className="max-w-[320px] py-2 pr-3">
                        <div className="text-foreground line-clamp-2 text-xs">
                          {q ? (
                            <MathText block={false}>{stemPreview(q.stem)}</MathText>
                          ) : (
                            <span className="bg-muted inline-block h-3.5 w-40 animate-pulse rounded" />
                          )}
                        </div>
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {entry.difficulty}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {entry.attempts}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {entry.pValue !== null ? entry.pValue.toFixed(2) : "-"}
                      </td>
                      <td
                        className={`px-2 py-2 text-right tabular-nums ${
                          entry.pointBiserial !== null && entry.pointBiserial < 0
                            ? "text-destructive font-semibold"
                            : ""
                        }`}
                      >
                        {entry.pointBiserial !== null
                          ? entry.pointBiserial.toFixed(2)
                          : "-"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {entry.avgTimeSec !== null ? `${entry.avgTimeSec}s` : "-"}
                      </td>
                      <td className="py-2 pl-2">
                        {entry.declaredVsObserved === "INSUFFICIENT_DATA" ? (
                          <span className="text-muted-foreground text-xs">
                            Needs more data
                          </span>
                        ) : entry.declaredVsObserved === "RELABEL_SUGGESTED" ? (
                          <span className="text-amber-600 text-xs">
                            Plays as {entry.suggestedDifficulty}
                          </span>
                        ) : (
                          <span className="text-emerald-600 text-xs">Healthy</span>
                        )}
                        {entry.flags.map((f) => (
                          <p key={f} className="text-destructive mt-0.5 text-xs">
                            {f}
                          </p>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center justify-between border-t p-4">
          <p className="text-muted-foreground text-xs">
            Page {page} of {totalPages}
            {data ? ` · ${data.total} questions` : ""}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
            >
              {isLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Next
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
