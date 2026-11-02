"use client";

import { Button } from "@open-mtlms/core";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";

import { QuestionEditorModal } from "@/components/test-series/QuestionEditorModal";
import {
  useTestQuestion,
  useTestQuestionBank,
} from "@/lib/hooks/use-test-series";

/**
 * Dedicated full-page test-bank question editor (replaces the ~800-line dialog).
 * `[questionId]` is "new" for creation, otherwise an existing question id (fetched
 * for edit). Reuses QuestionEditorModal in its `variant="page"` mode so the
 * authoring behavior is identical, only the chrome changes (page vs dialog).
 */
export default function QuestionEditorPage() {
  const params = useParams<{ bankId: string; questionId: string }>();
  const router = useRouter();
  const bankId = params?.bankId ?? "";
  const questionId = params?.questionId ?? "";
  const isNew = questionId === "new";

  const bankHref = `/dashboard/test-series/question-banks/${bankId}`;
  const back = useCallback(() => router.push(bankHref), [router, bankHref]);

  const { data: bank } = useTestQuestionBank(bankId);
  const { data: question, isLoading } = useTestQuestion(
    isNew ? undefined : questionId,
  );

  if (!isNew && isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isNew && !question) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          This question could not be found. It may have been deleted.
        </p>
        <Button variant="outline" size="sm" onClick={back}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to question bank
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <button
          type="button"
          onClick={back}
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to question bank
        </button>
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            href="/dashboard/test-series/question-banks"
            className="hover:text-foreground"
          >
            Question banks
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={bankHref} className="max-w-[220px] truncate hover:text-foreground">
            {bank?.name || "Bank"}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">
            {isNew ? "New question" : "Edit question"}
          </span>
        </nav>
      </div>

      <QuestionEditorModal
        variant="page"
        bankId={bankId}
        question={isNew ? null : (question ?? null)}
        open
        onOpenChange={(o) => {
          if (!o) back();
        }}
        onCreated={back}
      />
    </div>
  );
}
