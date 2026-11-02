"use client";

import { cn } from "@open-mtlms/core";
import { DragDropQuestion } from "@open-mtlms/lms-templates";

interface QuizOption {
  id: string;
  text?: string;
  option_text?: string;
}

interface QuizQuestionData {
  id: string;
  text?: string;
  question?: string;
  marks: number;
  /** Question type, undefined (legacy data) is treated as MCQ */
  question_type?: "MCQ" | "DRAG_DROP";
  options: QuizOption[];
}

interface QuizQuestionProps {
  question: QuizQuestionData;
  index: number;
  total: number;
  /**
   * Current answer: a single option id (MCQ / single-blank DRAG_DROP) or one
   * option id per blank for multi-blank DRAG_DROP (null = unfilled).
   */
  value: string | (string | null)[] | null;
  onChange: (next: string | (string | null)[] | null) => void;
  className?: string;
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function getOptionText(opt: QuizOption): string {
  return opt.text ?? opt.option_text ?? "";
}

function getQuestionText(q: QuizQuestionData): string {
  return q.text ?? q.question ?? "";
}

export function QuizQuestion({
  question,
  index,
  total,
  value,
  onChange,
  className,
}: QuizQuestionProps) {
  const isDragDrop = question.question_type === "DRAG_DROP";
  // MCQ uses a single string answer; coerce defensively (ignore array shape).
  const selectedOptionId = typeof value === "string" ? value : null;

  return (
    <div className={cn("flex flex-col gap-6 sm:gap-8", className)}>
      {/* Question header */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="inline-flex items-center rounded-lg bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Question {index + 1} of {total}
          </span>
          {question.marks > 0 && (
            <span className="text-xs text-muted-foreground">
              {question.marks} {question.marks === 1 ? "mark" : "marks"}
            </span>
          )}
        </div>
        {!isDragDrop && (
          <h2 className="text-lg font-semibold leading-relaxed text-foreground sm:text-xl">
            {getQuestionText(question)}
          </h2>
        )}
      </div>

      {/* Drag and drop (fill in the blank) */}
      {isDragDrop ? (
        <DragDropQuestion
          questionText={getQuestionText(question)}
          questionClassName="text-lg font-semibold text-foreground sm:text-xl"
          options={question.options.map((opt) => ({
            id: opt.id,
            text: getOptionText(opt),
          }))}
          value={value}
          onChange={onChange}
        />
      ) : (
        /* Options */
        <div className="flex flex-col gap-3">
          {question.options.map((opt, optIdx) => {
            const isSelected = selectedOptionId === opt.id;
            const letter = OPTION_LETTERS[optIdx] ?? String(optIdx + 1);

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange(opt.id)}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all sm:px-5 sm:py-4",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/50 hover:border-border hover:bg-muted/30"
                )}
              >
                {/* Letter badge */}
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/20"
                  )}
                >
                  {letter}
                </span>

                {/* Option text */}
                <span
                  className={cn(
                    "pt-1 text-sm leading-relaxed sm:text-base",
                    isSelected
                      ? "font-medium text-foreground"
                      : "text-foreground/80"
                  )}
                >
                  {getOptionText(opt)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
