"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useToast,
} from "@open-mtlms/core";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import {
  downloadTextFile,
  serializeQuestions,
  serializeSheetCsv,
  toFileSlug,
  type ParsedQuestion,
  type QuizFormat,
} from "@/lib/quiz-formats";

interface Props {
  /**
   * Resolves the questions to export as canonical IR. May fetch first, so it is
   * async. Return an empty array when there is nothing to export.
   */
  getQuestions: () => Promise<ParsedQuestion[]> | ParsedQuestion[];
  /** Base name for the downloaded file (bank name or quiz title). */
  fileBaseName: string;
  /**
   * Offer the CSV (spreadsheet) format: full fidelity for test series question
   * banks (all types incl. drag & drop, plus metadata). Course quizzes keep
   * AIKEN/GIFT only since their import has no CSV path here.
   */
  includeCsv?: boolean;
  disabled?: boolean;
  size?: "sm" | "default";
  variant?: "outline" | "ghost";
}

export function QuestionExportButton({
  getQuestions,
  fileBaseName,
  includeCsv = false,
  disabled,
  size = "sm",
  variant = "outline",
}: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleExport = async (format: QuizFormat | "CSV") => {
    setBusy(true);
    try {
      const questions = await getQuestions();
      if (questions.length === 0) {
        toast({
          title: "Nothing to export",
          description: "There are no questions here yet.",
          variant: "destructive",
        });
        return;
      }
      const { content, skipped } =
        format === "CSV"
          ? serializeSheetCsv(questions)
          : serializeQuestions(questions, format);
      if (!content.trim() || skipped === questions.length) {
        toast({
          title: "Nothing to export",
          description: `None of these questions can be represented in ${format}.`,
          variant: "destructive",
        });
        return;
      }
      downloadTextFile(
        format === "CSV"
          ? `${toFileSlug(fileBaseName)}.csv`
          : `${toFileSlug(fileBaseName)}.${format.toLowerCase()}.txt`,
        content
      );
      toast({
        title: `Exported ${questions.length - skipped} question${
          questions.length - skipped === 1 ? "" : "s"
        } to ${format}`,
        description:
          skipped > 0
            ? `${skipped} skipped (not representable in ${format}; try ${
                includeCsv ? "CSV" : "GIFT"
              } for full fidelity).`
            : undefined,
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled || busy}>
          {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("AIKEN")}>
          Export as AIKEN
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("GIFT")}>
          Export as GIFT
        </DropdownMenuItem>
        {includeCsv && (
          <DropdownMenuItem onClick={() => handleExport("CSV")}>
            Export as CSV
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
