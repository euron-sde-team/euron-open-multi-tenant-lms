"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  SkeletonRows,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@open-mtlms/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { QuestionExportButton } from "@/components/quiz-formats/QuestionExportButton";
import {
  QuestionImportDialog,
  type ImportDefaults,
} from "@/components/quiz-formats/QuestionImportDialog";
import { AIGenerateModal } from "@/components/test-series/AIGenerateModal";
import { MathText } from "@/components/test-series/MathText";
import { QuestionHealthDialog } from "@/components/test-series/QuestionHealthDialog";
import {
  testQuestionsApi,
  type TestQuestion,
  type TestQuestionDifficulty,
  type TestQuestionStatus,
  type TestQuestionType,
} from "@/lib/api/test-series";
import {
  useTestQuestionBank,
  useTestQuestions,
  useDeleteTestQuestion,
  useBulkUpdateQuestionStatus,
  useBulkImportQuestions,
  useTaxonomy,
  testSeriesKeys,
} from "@/lib/hooks/use-test-series";
import {
  testQuestionToIR,
  toTestSeriesPayload,
  type ParsedQuestion,
} from "@/lib/quiz-formats";
import { decodeEntities } from "@/lib/quiz-formats/text";
import {
  answerSummary,
  correctIdSet,
  optionParts,
  stemParts,
} from "@/lib/utils/test-question-render";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

const PAGE_SIZE = 50;
/** Radix Select cannot hold an empty string value, so "no filter" needs a token. */
const ALL_NODES = "__all__";

/** Debounce the search box so typing does not fire a request per keystroke. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

const TYPE_LABEL: Record<TestQuestionType, string> = {
  MCQ_SINGLE: "MCQ",
  MCQ_MULTI: "MSQ",
  TRUE_FALSE: "T/F",
  FIB: "Fill",
  NAT: "Num",
  DRAG_DROP: "Drag",
  DESCRIPTIVE: "Descriptive",
};

const DIFF_COLOR: Record<TestQuestionDifficulty, string> = {
  EASY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  HARD: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

function getStemPreview(stem: unknown): string {
  // The global XSS sanitizer encodes input on save, so stored text holds HTML
  // entities (e.g. "&amp;"). Decode at this render point so previews read
  // naturally. Display-only; nothing is written back.
  if (typeof stem === "string") return decodeEntities(stem);
  if (typeof stem === "object" && stem !== null) {
    const o = stem as Record<string, unknown>;
    if (typeof o.text === "string") return decodeEntities(o.text);
    if (typeof o.html === "string") return decodeEntities(o.html.replace(/<[^>]+>/g, ""));
  }
  return JSON.stringify(stem ?? "");
}

/** Inline options + correct answer so a question can be verified without opening it. */
function QuestionAnswerInline({ q }: { q: TestQuestion }) {
  // Descriptive questions are human-graded, there's no stored correct answer.
  if (q.type === "DESCRIPTIVE") {
    return (
      <p className="text-muted-foreground mt-1.5 text-xs italic">
        Descriptive, graded manually by an evaluator.
      </p>
    );
  }
  const options = optionParts(q.options);
  const correct = correctIdSet(q.correctAnswer);
  if (options.length === 0) {
    return (
      <p className="mt-1.5 text-xs">
        <span className="text-muted-foreground">Answer: </span>
        <span className="font-medium text-emerald-600">
          {answerSummary(q.options, q.correctAnswer)}
        </span>
      </p>
    );
  }
  return (
    <div className="mt-1.5 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
      {options.map((o) => {
        const isCorrect = correct.has(o.id.toUpperCase());
        return (
          <div
            key={o.id}
            className={`flex items-start gap-1 text-xs ${
              isCorrect ? "font-medium text-emerald-600" : "text-muted-foreground"
            }`}
          >
            <span className="shrink-0">{o.id}.</span>
            <span className="flex min-w-0 items-center gap-1.5">
              {o.imageUrl && (
                <img
                  src={o.imageUrl}
                  alt=""
                  className="h-8 w-auto max-w-[80px] shrink-0 rounded border border-border object-contain"
                />
              )}
              {o.label ? (
                <MathText block={false}>{o.label}</MathText>
              ) : (
                !o.imageUrl && <span>(empty)</span>
              )}
            </span>
            {isCorrect && <span className="shrink-0">✓</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function QuestionBankDetailPage() {
  const params = useParams<{ bankId: string }>();
  const bankId = params?.bankId ?? "";
  const router = useRouter();
  const questionEditorHref = (questionId: string) =>
    `/dashboard/test-series/question-banks/${bankId}/questions/${questionId}/editor`;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TestQuestionStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<TestQuestionType | "ALL">("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<TestQuestionDifficulty | "ALL">("ALL");
  const [subjectNodeId, setSubjectNodeId] = useState("");
  const [chapterNodeId, setChapterNodeId] = useState("");
  const [topicNodeId, setTopicNodeId] = useState("");
  const [page, setPage] = useState(1);
  const [showAnswers, setShowAnswers] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const aiAuthoringEnabled = useAiAuthoringEnabled();
  const [importOpen, setImportOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Cascading taxonomy filters, same source as the question editor's dropdowns.
  const { data: subjectNodes = [] } = useTaxonomy("SUBJECT");
  const { data: chapterNodes = [] } = useTaxonomy(
    "CHAPTER",
    subjectNodeId || undefined
  );
  const { data: topicNodes = [] } = useTaxonomy(
    "TOPIC",
    chapterNodeId || undefined
  );

  // The search runs on the server: a bank can hold thousands of questions and
  // only one page is ever in memory, so filtering the loaded rows would only
  // ever search the current page.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const { data: bank } = useTestQuestionBank(bankId);
  const { data, isLoading, isFetching } = useTestQuestions({
    question_bank_id: bankId,
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    type: typeFilter === "ALL" ? undefined : typeFilter,
    difficulty: difficultyFilter === "ALL" ? undefined : difficultyFilter,
    subject_node_id: subjectNodeId || undefined,
    chapter_node_id: chapterNodeId || undefined,
    topic_node_id: topicNodeId || undefined,
  });

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    statusFilter,
    typeFilter,
    difficultyFilter,
    subjectNodeId,
    chapterNodeId,
    topicNodeId,
  ]);

  const deleteMut = useDeleteTestQuestion();
  const bulkStatusMut = useBulkUpdateQuestionStatus();
  const bulkImportMut = useBulkImportQuestions();

  // Import: map IR -> bulk payload, chunked at the backend's 500-per-request cap.
  const handleImportConfirm = async (
    questions: ParsedQuestion[],
    defaults: ImportDefaults
  ) => {
    const payload = questions.map((q) => toTestSeriesPayload(q, defaults));
    let created = 0;
    let skipped = 0;
    const duplicates: Array<{ question: string; reason: string }> = [];
    const failed: Array<{ index: number; error: string }> = [];
    const CHUNK = 500;
    for (let i = 0; i < payload.length; i += CHUNK) {
      const slice = payload.slice(i, i + CHUNK);
      const res = await bulkImportMut.mutateAsync({ bankId, questions: slice });
      created += res.created;
      skipped += res.skipped ?? 0;
      if (res.duplicates) duplicates.push(...res.duplicates);
      res.failed.forEach((f) =>
        failed.push({ index: i + f.index, error: f.error })
      );
    }
    return { created, failed, skipped, duplicates };
  };

  // Multi-format AI import: upload a Word/PDF/Excel/CSV file → Gemini parses it.
  // Invoked from the Import dialog (onWordImport); the dialog owns the upload UI
  // + progress spinner, so this just runs the request and toasts the result.
  const handleAiFileImport = async (file: File) => {
    try {
      const res = await testQuestionsApi.importFileAI(bankId, file);
      toast({
        title: "AI import complete",
        description: `Created ${res.created} of ${res.parsed} parsed question${
          res.parsed === 1 ? "" : "s"
        }${res.skipped ? ` · ${res.skipped} skipped` : ""}.`,
      });
      queryClient.invalidateQueries({ queryKey: testSeriesKeys.questions.all });
    } catch (err) {
      toast({
        title: "AI import failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Download the ready-to-fill Word template so staff can format questions in a
  // way that imports cleanly (one question per block: Q: … A) B) C) … Answer: …).
  const handleDownloadTemplate = async () => {
    try {
      await testQuestionsApi.downloadDocxTemplate();
    } catch (err) {
      toast({
        title: "Could not download the template",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Export: pull every question in the bank (regardless of active filters).
  const getExportQuestions = async (): Promise<ParsedQuestion[]> => {
    const all: TestQuestion[] = [];
    let page = 1;
    for (;;) {
      const res = await testQuestionsApi.list({
        question_bank_id: bankId,
        page,
        limit: 500,
      });
      all.push(...res.questions);
      if (res.questions.length === 0 || all.length >= res.total || page > 40)
        break;
      page += 1;
    }
    return all.map(testQuestionToIR);
  };

  // Every filter is applied server side, so the page is the result.
  const filtered = useMemo(() => data?.questions ?? [], [data?.questions]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const hasFilters =
    debouncedSearch.length > 0 ||
    statusFilter !== "ALL" ||
    typeFilter !== "ALL" ||
    difficultyFilter !== "ALL" ||
    Boolean(subjectNodeId || chapterNodeId || topicNodeId);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setDifficultyFilter("ALL");
    setSubjectNodeId("");
    setChapterNodeId("");
    setTopicNodeId("");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredIds = useMemo(() => filtered.map((q) => q.id), [filtered]);
  const allSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const someSelected =
    allFilteredIds.length > 0 && allFilteredIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of allFilteredIds) next.delete(id);
      } else {
        for (const id of allFilteredIds) next.add(id);
      }
      return next;
    });
  };

  const handleBulkStatus = (status: TestQuestionStatus) => {
    if (selectedIds.size === 0) return;
    bulkStatusMut.mutate(
      { questionIds: Array.from(selectedIds), status },
      {
        onSuccess: (res) => {
          toast({ title: `Updated ${res.updated} questions to ${status}` });
          setSelectedIds(new Set());
        },
        onError: (err) => {
          toast({
            title: "Bulk update failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleRowStatus = (questionId: string, status: TestQuestionStatus) => {
    bulkStatusMut.mutate(
      { questionIds: [questionId], status },
      {
        onSuccess: () => toast({ title: `Status: ${status}` }),
        onError: (err) =>
          toast({
            title: "Update failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMut.mutate(deleteId, {
      onSuccess: () => {
        toast({ title: "Question deleted" });
        setDeleteId(null);
      },
      onError: (err) => {
        toast({
          title: "Delete failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/dashboard/test-series/question-banks"
        className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to banks
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{bank?.name ?? "Question Bank"}</h1>
          {bank?.description && (
            <p className="text-muted-foreground mt-1">{bank.description}</p>
          )}
          <p className="text-muted-foreground mt-1 text-sm">
            {total} {total === 1 ? "question" : "questions"}
            {hasFilters ? " match the filters" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setHealthOpen(true)}>
            <Activity className="mr-2 h-4 w-4" />
            Question health
          </Button>
          <QuestionExportButton
            getQuestions={getExportQuestions}
            fileBaseName={bank?.name ?? "question-bank"}
            includeCsv
          />
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Import
          </Button>
          {aiAuthoringEnabled && (
            <Button variant="outline" onClick={() => setAiOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate with AI
            </Button>
          )}
          <Button onClick={() => router.push(questionEditorHref("new"))}>
            <Plus className="mr-2 h-4 w-4" />
            New Question
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search every question in this bank…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TestQuestionStatus | "ALL")}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TestQuestionType | "ALL")}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="MCQ_SINGLE">MCQ (single)</SelectItem>
            <SelectItem value="MCQ_MULTI">MCQ (multi)</SelectItem>
            <SelectItem value="TRUE_FALSE">True / False</SelectItem>
            <SelectItem value="FIB">Fill in the blank</SelectItem>
            <SelectItem value="NAT">Numerical</SelectItem>
            <SelectItem value="DRAG_DROP">Drag &amp; drop</SelectItem>
            <SelectItem value="DESCRIPTIVE">Descriptive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={difficultyFilter} onValueChange={(v) => setDifficultyFilter(v as TestQuestionDifficulty | "ALL")}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All levels</SelectItem>
            <SelectItem value="EASY">Easy</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HARD">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showAnswers ? "default" : "outline"}
          onClick={() => setShowAnswers((v) => !v)}
          title="Show the options and correct answer inline so you can verify questions without opening each one"
        >
          {showAnswers ? (
            <Eye className="mr-1 h-4 w-4" />
          ) : (
            <EyeOff className="mr-1 h-4 w-4" />
          )}
          {showAnswers ? "Answers shown" : "Show answers"}
        </Button>
      </div>

      {/* Subject, chapter and topic. Cascading, so chapters are scoped to the
          chosen subject and topics to the chosen chapter. */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={subjectNodeId || ALL_NODES}
          onValueChange={(v) => {
            setSubjectNodeId(v === ALL_NODES ? "" : v);
            setChapterNodeId("");
            setTopicNodeId("");
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_NODES}>All subjects</SelectItem>
            {subjectNodes.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {decodeEntities(n.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={chapterNodeId || ALL_NODES}
          onValueChange={(v) => {
            setChapterNodeId(v === ALL_NODES ? "" : v);
            setTopicNodeId("");
          }}
          disabled={!subjectNodeId}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All chapters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_NODES}>All chapters</SelectItem>
            {chapterNodes.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {decodeEntities(n.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={topicNodeId || ALL_NODES}
          onValueChange={(v) => setTopicNodeId(v === ALL_NODES ? "" : v)}
          disabled={!chapterNodeId}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All topics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_NODES}>All topics</SelectItem>
            {topicNodes.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {decodeEntities(n.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
        <span className="text-muted-foreground ml-auto text-xs">
          {isFetching ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching…
            </span>
          ) : total > 0 ? (
            `Showing ${rangeStart}–${rangeEnd} of ${total}`
          ) : null}
        </span>
      </div>

      {selectedIds.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
            <p className="text-sm">{selectedIds.size} selected</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => handleBulkStatus("DRAFT")} disabled={bulkStatusMut.isPending}>
                Move to draft
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkStatus("PUBLISHED")} disabled={bulkStatusMut.isPending}>
                Publish
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkStatus("ARCHIVED")} disabled={bulkStatusMut.isPending}>
                Archive
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filtered.length > 0 && (
        <div className="flex items-center gap-2 px-1 text-sm">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = !allSelected && someSelected;
            }}
            onChange={toggleSelectAll}
            className="h-4 w-4"
            aria-label="Select all"
          />
          <span className="text-muted-foreground">
            {allSelected
              ? `All ${filtered.length} on this page selected`
              : someSelected
                ? `${selectedIds.size} of ${filtered.length} on this page selected`
                : `Select all ${filtered.length} on this page`}
          </span>
        </div>
      )}

      {isLoading ? (
        <SkeletonRows rows={8} rowClassName="h-16" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-12 text-center">
            <p className="text-muted-foreground">No questions match the filters</p>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => {
            const checked = selectedIds.has(q.id);
            return (
              <Card key={q.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(q.id)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{TYPE_LABEL[q.type] ?? q.type}</Badge>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${DIFF_COLOR[q.difficulty] ?? ""}`}>
                        {q.difficulty}
                      </span>
                      {q.createdVia === "AI" && (
                        <Badge variant="outline" className="border-primary/40 text-primary">
                          <Sparkles className="mr-1 h-3 w-3" />
                          AI
                        </Badge>
                      )}
                      {(q.subject || q.chapter || q.topic) && (
                        <span className="text-muted-foreground text-xs">
                          {[q.subject, q.chapter, q.topic]
                            .filter(Boolean)
                            .map((v) => decodeEntities(String(v)))
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-start gap-2">
                      {stemParts(q.stem).imageUrl && (
                        <img
                          src={stemParts(q.stem).imageUrl as string}
                          alt=""
                          className="mt-0.5 h-10 w-auto max-w-[112px] shrink-0 rounded border border-border object-contain"
                        />
                      )}
                      <div className="text-foreground line-clamp-2 text-sm">
                        <MathText block={false}>{getStemPreview(q.stem)}</MathText>
                      </div>
                    </div>
                    {showAnswers && <QuestionAnswerInline q={q} />}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Select
                      value={q.status}
                      onValueChange={(v) =>
                        handleRowStatus(q.id, v as TestQuestionStatus)
                      }
                    >
                      <SelectTrigger className="h-8 w-32 text-xs" aria-label="Status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="PUBLISHED">Published</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => router.push(questionEditorHref(q.id))} aria-label="Edit">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(q.id)} aria-label="Delete">
                      <Trash2 className="text-destructive h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* AI generation modal */}
      <AIGenerateModal
        bankId={bankId}
        open={aiOpen}
        onOpenChange={setAiOpen}
        onCompleted={() => {
          queryClient.invalidateQueries({ queryKey: testSeriesKeys.questions.all });
        }}
      />

      {/* AIKEN / GIFT import */}
      <QuestionImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        target="TEST_SERIES"
        onConfirm={handleImportConfirm}
        onWordImport={handleAiFileImport}
        onDownloadWordSample={() => void handleDownloadTemplate()}
      />

      {/* CTT question-health stats */}
      <QuestionHealthDialog
        bankId={bankId}
        open={healthOpen}
        onOpenChange={setHealthOpen}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the question from any tests it&apos;s attached to.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
