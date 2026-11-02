"use client";

import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Library,
  ListChecks,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  questionLibraryApi,
  type LibraryQuizNode,
  type QuestionCourseStatus,
  type QuestionCourseSummary,
  type QuestionSearchHit,
} from "../../lib/api/question-library";
import {
  useImportQuestions,
  useQuestionLibraryCourseTree,
  useQuestionLibraryCourses,
  useQuestionLibrarySearch,
} from "../../lib/hooks/use-question-library";

interface QuestionLibraryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Destination course id (the LMS course being edited). */
  courseId: string;
  /** Destination quiz the picked questions are copied into. */
  quizId: string;
  /** Called after a successful import (e.g. to refresh local UI). */
  onImported?: (added: number) => void;
}

type StatusFilter = "ALL" | QuestionCourseStatus;

/** A picked question (and its options) in the editable review step. */
interface EditableQuestion {
  key: string; // stable react key
  question: string;
  marks: number;
  options: Array<{ key: string; option_text: string; is_correct: boolean }>;
}

export function QuestionLibraryPicker({
  open,
  onOpenChange,
  courseId,
  quizId,
  onImported,
}: QuestionLibraryPickerProps) {
  const { toast } = useToast();
  const [view, setView] = useState<"browse" | "review">("browse");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(
    new Set()
  );
  // Cart of selected source question ids, keyed for O(1) toggling.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reviewItems, setReviewItems] = useState<EditableQuestion[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);
  const keySeq = useRef(0);

  const debouncedSearch = useDebouncedValue(search, 250);
  const isSearching = debouncedSearch.trim().length >= 2;

  const importMutation = useImportQuestions(courseId, quizId);

  // Reset everything on close so reopening starts clean.
  useEffect(() => {
    if (!open) {
      setView("browse");
      setSearch("");
      setStatusFilter("ALL");
      setExpandedCourses(new Set());
      setSelectedIds(new Set());
      setReviewItems([]);
      setLoadingReview(false);
    }
  }, [open]);

  const toggleSelected = (questionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleOpenReview = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setLoadingReview(true);
    try {
      const details = await questionLibraryApi.getQuestionsDetail(ids);
      setReviewItems(
        details.map((d) => ({
          key: `q-${keySeq.current++}`,
          question: d.question,
          marks: d.marks,
          options: d.options.map((o) => ({
            key: `o-${keySeq.current++}`,
            option_text: o.optionText,
            is_correct: o.isCorrect,
          })),
        }))
      );
      setView("review");
    } catch (err) {
      toast({
        title: "Could not load selected questions",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoadingReview(false);
    }
  };

  const handleImport = () => {
    const payload = reviewItems
      .map((q) => ({
        question: q.question.trim(),
        marks: q.marks > 0 ? q.marks : 1,
        options: q.options
          .map((o, i) => ({
            option_text: o.option_text.trim(),
            is_correct: o.is_correct,
            sort_order: i,
          }))
          .filter((o) => o.option_text.length > 0),
      }))
      .filter((q) => q.question.length > 0);

    if (payload.length === 0) {
      toast({
        title: "Nothing to import",
        description: "Add at least one question with text.",
        variant: "destructive",
      });
      return;
    }

    importMutation.mutate(
      { quizId, questions: payload },
      {
        onSuccess: (result) => {
          toast({
            title: `${result.added} question(s) added to this quiz`,
          });
          onImported?.(result.added);
          onOpenChange(false);
        },
        onError: (err) => {
          toast({
            title: "Import failed",
            description: err instanceof Error ? err.message : undefined,
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[820px] p-0 sm:rounded-lg overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Library className="h-4 w-4 text-primary" />
            Question Library
            <span className="ml-2 font-normal text-xs text-muted-foreground">
              {view === "browse"
                ? "Pick questions from any quiz in any of your courses"
                : "Review and edit before adding to this quiz"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {view === "browse" ? (
          <>
            <div className="p-3 border-b space-y-2 bg-background">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search questions, quizzes, courses..."
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <div className="flex gap-1">
                <StatusPill
                  active={statusFilter === "ALL"}
                  onClick={() => setStatusFilter("ALL")}
                  label="All"
                />
                <StatusPill
                  active={statusFilter === "PUBLISHED"}
                  onClick={() => setStatusFilter("PUBLISHED")}
                  label="Published"
                />
                <StatusPill
                  active={statusFilter === "DRAFT"}
                  onClick={() => setStatusFilter("DRAFT")}
                  label="Draft"
                />
              </div>
            </div>

            <div className="h-[440px] overflow-y-auto bg-muted/20">
              {isSearching ? (
                <SearchResults
                  query={debouncedSearch}
                  selectedIds={selectedIds}
                  onToggle={toggleSelected}
                />
              ) : (
                <CourseTreeList
                  statusFilter={statusFilter}
                  expanded={expandedCourses}
                  setExpanded={setExpandedCourses}
                  selectedIds={selectedIds}
                  onToggle={toggleSelected}
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size === 0
                  ? "No questions selected"
                  : `${selectedIds.size} question${selectedIds.size === 1 ? "" : "s"} selected`}
              </span>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedIds.size === 0 || loadingReview}
                  onClick={handleOpenReview}
                >
                  {loadingReview ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ListChecks className="mr-1.5 h-3.5 w-3.5" />
                      Review &amp; edit
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <ReviewStep
            items={reviewItems}
            setItems={setReviewItems}
            nextKey={() => `x-${keySeq.current++}`}
            onBack={() => setView("browse")}
            onImport={handleImport}
            importing={importMutation.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Browse: course tree ─────────────────────────────────────────────────────

function CourseTreeList({
  statusFilter,
  expanded,
  setExpanded,
  selectedIds,
  onToggle,
}: {
  statusFilter: StatusFilter;
  expanded: Set<string>;
  setExpanded: (next: Set<string>) => void;
  selectedIds: Set<string>;
  onToggle: (questionId: string) => void;
}) {
  const status = statusFilter === "ALL" ? undefined : statusFilter;
  const { data, isLoading, isError } = useQuestionLibraryCourses({ status });
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;
  if (!data || data.items.length === 0)
    return <EmptyState label="No courses with quiz questions yet" />;

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  return (
    <div className="py-1">
      {data.items.map((course) => (
        <CourseRow
          key={course.id}
          course={course}
          expanded={expanded.has(course.id)}
          onToggle={() => toggle(course.id)}
          selectedIds={selectedIds}
          onToggleQuestion={onToggle}
        />
      ))}
    </div>
  );
}

function CourseRow({
  course,
  expanded,
  onToggle,
  selectedIds,
  onToggleQuestion,
}: {
  course: QuestionCourseSummary;
  expanded: boolean;
  onToggle: () => void;
  selectedIds: Set<string>;
  onToggleQuestion: (questionId: string) => void;
}) {
  const { data: tree, isLoading } = useQuestionLibraryCourseTree(
    expanded ? course.id : null
  );
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left text-sm hover:bg-muted/60 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate flex-1">{course.title}</span>
        <Badge
          variant={course.status === "PUBLISHED" ? "default" : "outline"}
          className="text-[10px] py-0 px-1.5 font-normal"
        >
          {course.status === "PUBLISHED" ? "Live" : "Draft"}
        </Badge>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {course.questionCount}
        </span>
      </button>
      {expanded && (
        <div className="pl-3">
          {isLoading ? (
            <LoadingState compact />
          ) : tree && tree.quizzes.length > 0 ? (
            tree.quizzes.map((quiz) => (
              <QuizRow
                key={quiz.quizId}
                quiz={quiz}
                selectedIds={selectedIds}
                onToggleQuestion={onToggleQuestion}
              />
            ))
          ) : (
            <EmptyState compact label="No questions in this course" />
          )}
        </div>
      )}
    </div>
  );
}

function QuizRow({
  quiz,
  selectedIds,
  onToggleQuestion,
}: {
  quiz: LibraryQuizNode;
  selectedIds: Set<string>;
  onToggleQuestion: (questionId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-l ml-1.5 pl-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-1.5 py-1 text-left text-[13px] text-foreground/80 hover:bg-muted/40 rounded"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <ListChecks className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="truncate flex-1">{quiz.quizTitle}</span>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {quiz.questions.length}
        </span>
      </button>
      {open && (
        <div className="pl-3">
          {quiz.questions.map((q) => (
            <QuestionPickRow
              key={q.questionId}
              questionId={q.questionId}
              text={q.question}
              marks={q.marks}
              optionCount={q.optionCount}
              checked={selectedIds.has(q.questionId)}
              onToggle={() => onToggleQuestion(q.questionId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionPickRow({
  questionId: _questionId,
  text,
  marks,
  optionCount,
  checked,
  onToggle,
}: {
  questionId: string;
  text: string;
  marks: number;
  optionCount: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-2 px-1.5 py-1 text-[13px] rounded cursor-pointer transition-colors",
        checked ? "bg-primary/10 text-foreground" : "hover:bg-muted/40 text-foreground/80"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
      />
      <HelpCircle className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
      <span className="flex-1 line-clamp-2">{text}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
        {optionCount} opt · {marks} mark{marks === 1 ? "" : "s"}
      </span>
    </label>
  );
}

// ─── Browse: search results ──────────────────────────────────────────────────

function SearchResults({
  query,
  selectedIds,
  onToggle,
}: {
  query: string;
  selectedIds: Set<string>;
  onToggle: (questionId: string) => void;
}) {
  const { data, isLoading, isError } = useQuestionLibrarySearch(query);
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;
  if (!data || data.length === 0)
    return <EmptyState label={`No matches for "${query}"`} />;
  return (
    <div className="py-1">
      {data.map((hit: QuestionSearchHit) => (
        <label
          key={hit.questionId}
          className={cn(
            "flex items-start gap-2 px-2.5 py-1.5 text-left transition-colors border-b last:border-0 cursor-pointer",
            selectedIds.has(hit.questionId) ? "bg-primary/10" : "hover:bg-muted/40"
          )}
        >
          <input
            type="checkbox"
            checked={selectedIds.has(hit.questionId)}
            onChange={() => onToggle(hit.questionId)}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex-1 line-clamp-2">{hit.question}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {hit.optionCount} opt · {hit.marks} mark{hit.marks === 1 ? "" : "s"}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              {hit.courseTitle} <span className="opacity-60">›</span> {hit.quizTitle}
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}

// ─── Review & edit step ──────────────────────────────────────────────────────

function ReviewStep({
  items,
  setItems,
  nextKey,
  onBack,
  onImport,
  importing,
}: {
  items: EditableQuestion[];
  setItems: React.Dispatch<React.SetStateAction<EditableQuestion[]>>;
  nextKey: () => string;
  onBack: () => void;
  onImport: () => void;
  importing: boolean;
}) {
  const updateQuestion = (key: string, patch: Partial<EditableQuestion>) =>
    setItems((prev) =>
      prev.map((q) => (q.key === key ? { ...q, ...patch } : q))
    );

  const removeQuestion = (key: string) =>
    setItems((prev) => prev.filter((q) => q.key !== key));

  const updateOption = (
    qKey: string,
    oKey: string,
    patch: Partial<EditableQuestion["options"][number]>
  ) =>
    setItems((prev) =>
      prev.map((q) =>
        q.key === qKey
          ? {
              ...q,
              options: q.options.map((o) =>
                o.key === oKey ? { ...o, ...patch } : o
              ),
            }
          : q
      )
    );

  const removeOption = (qKey: string, oKey: string) =>
    setItems((prev) =>
      prev.map((q) =>
        q.key === qKey
          ? { ...q, options: q.options.filter((o) => o.key !== oKey) }
          : q
      )
    );

  const addOption = (qKey: string) =>
    setItems((prev) =>
      prev.map((q) =>
        q.key === qKey
          ? {
              ...q,
              options: [
                ...q.options,
                { key: nextKey(), option_text: "", is_correct: false },
              ],
            }
          : q
      )
    );

  return (
    <>
      <div className="h-[460px] overflow-y-auto p-4 space-y-4 bg-muted/20">
        {items.length === 0 ? (
          <EmptyState label="No questions selected" />
        ) : (
          items.map((q, idx) => (
            <div
              key={q.key}
              className="rounded-lg border bg-background p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                <span className="mt-2 text-xs font-medium text-muted-foreground tabular-nums">
                  {idx + 1}.
                </span>
                <Textarea
                  value={q.question}
                  onChange={(e) =>
                    updateQuestion(q.key, { question: e.target.value })
                  }
                  rows={2}
                  className="flex-1 resize-none text-sm"
                  placeholder="Question text..."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeQuestion(q.key)}
                  aria-label="Remove question"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 pl-6">
                <Label className="text-xs">Marks</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={q.marks}
                  onChange={(e) =>
                    updateQuestion(q.key, {
                      marks: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="w-16 h-8"
                />
              </div>

              <div className="pl-6 space-y-1.5">
                {q.options.map((o) => (
                  <div key={o.key} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateOption(q.key, o.key, { is_correct: !o.is_correct })
                      }
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                        o.is_correct
                          ? "border-green-600 bg-green-600 text-white"
                          : "border-input text-transparent hover:border-green-600/50"
                      )}
                      aria-label={
                        o.is_correct ? "Marked correct" : "Mark correct"
                      }
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <Input
                      value={o.option_text}
                      onChange={(e) =>
                        updateOption(q.key, o.key, {
                          option_text: e.target.value,
                        })
                      }
                      className="h-8 flex-1 text-sm"
                      placeholder="Option text..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeOption(q.key, o.key)}
                      aria-label="Remove option"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => addOption(q.key)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add option
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          Back
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={importing || items.length === 0}
          onClick={onImport}
        >
          {importing ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add {items.length} question{items.length === 1 ? "" : "s"} to this quiz
            </>
          )}
        </Button>
      </div>
    </>
  );
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function StatusPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2 py-0.5 text-[11px] rounded-full border transition-colors",
        active
          ? "bg-primary/10 border-primary/30 text-foreground"
          : "border-transparent text-muted-foreground hover:bg-muted/50"
      )}
    >
      {label}
    </button>
  );
}

function LoadingState({ compact }: { compact?: boolean } = {}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-muted-foreground text-sm",
        compact ? "px-2 py-1" : "p-4 justify-center"
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Loading...</span>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="p-4 text-center text-sm text-destructive">
      Could not load question library
    </div>
  );
}

function EmptyState({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "text-center text-muted-foreground",
        compact ? "px-3 py-2 text-xs" : "p-6 text-sm"
      )}
    >
      <HelpCircle
        className={cn(
          "mx-auto opacity-30",
          compact ? "h-4 w-4 mb-1" : "h-6 w-6 mb-2"
        )}
      />
      {label}
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
