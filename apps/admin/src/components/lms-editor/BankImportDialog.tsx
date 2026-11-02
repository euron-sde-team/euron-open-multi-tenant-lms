"use client";

import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@open-mtlms/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { coursesLmsApi } from "@/lib/api/courses-lms";
import { testQuestionsApi } from "@/lib/api/test-series";
import { useTestQuestionBanks } from "@/lib/hooks/use-test-series";

interface Props {
  courseId: string;
  quizId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

interface BankItem {
  id: string;
  name: string;
}

const FETCH_LIMIT = 200;

/** Extract a plain-text preview from a (possibly rich) question stem. */
function getStemPreview(stem: unknown): string {
  if (typeof stem === "string") return stem;
  if (typeof stem === "object" && stem !== null) {
    const text = (stem as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return "";
}

/**
 * Imports questions from a Test Series Question Bank into a course quiz.
 * After picking a bank you choose which questions to bring over (or select all).
 * Rich question types are converted to the quiz shape; unsupported types and
 * duplicates are skipped and reported.
 */
export function BankImportDialog({
  courseId,
  quizId,
  open,
  onOpenChange,
  onImported,
}: Props) {
  const { toast } = useToast();
  const { data: banksData, isLoading: banksLoading } = useTestQuestionBanks({
    limit: 100,
  });
  const [bankId, setBankId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  // Shared-pool filters (subject / chapter / topic / difficulty) + random count.
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [randomCount, setRandomCount] = useState("");

  const rawBanks = banksData as unknown as
    | { banks?: BankItem[]; data?: BankItem[] }
    | BankItem[]
    | undefined;
  const banks: BankItem[] = Array.isArray(rawBanks)
    ? rawBanks
    : rawBanks?.banks ?? rawBanks?.data ?? [];

  // Debounce search so typing doesn't refetch on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  // Reset everything on close so reopening starts clean.
  useEffect(() => {
    if (!open) {
      setBankId("");
      setSearch("");
      setDebouncedSearch("");
      setSelectedIds(new Set());
      setImporting(false);
      setSubject("");
      setChapter("");
      setTopic("");
      setDifficulty("");
      setRandomCount("");
    }
  }, [open]);

  const { data: questionsData, isLoading: questionsLoading } = useQuery({
    queryKey: [
      "bank-import-questions",
      bankId,
      debouncedSearch,
      subject,
      chapter,
      topic,
      difficulty,
    ],
    queryFn: () =>
      testQuestionsApi.list({
        question_bank_id: bankId,
        limit: FETCH_LIMIT,
        search: debouncedSearch.trim() || undefined,
        subject: subject.trim() || undefined,
        chapter: chapter.trim() || undefined,
        topic: topic.trim() || undefined,
        difficulty: (difficulty || undefined) as
          | "EASY"
          | "MEDIUM"
          | "HARD"
          | undefined,
      }),
    enabled: !!bankId,
    placeholderData: keepPreviousData,
  });

  const questions = useMemo(
    () => questionsData?.questions ?? [],
    [questionsData]
  );
  const total = questionsData?.total ?? 0;

  const allSelected = useMemo(
    () => questions.length > 0 && questions.every((q) => selectedIds.has(q.id)),
    [questions, selectedIds]
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) questions.forEach((q) => next.delete(q.id));
      else questions.forEach((q) => next.add(q.id));
      return next;
    });
  };

  const handleBankChange = (id: string) => {
    setBankId(id);
    setSelectedIds(new Set());
    setSearch("");
    setDebouncedSearch("");
  };

  const runImport = async (
    questionIds: string[] | undefined,
    selection?: {
      subject?: string;
      chapter?: string;
      topic?: string;
      difficulty?: string;
      count?: number;
    }
  ) => {
    setImporting(true);
    try {
      const res = await coursesLmsApi.importQuizQuestionsFromBank(
        courseId,
        quizId,
        bankId,
        questionIds,
        selection
      );
      const parts = [`${res.created} imported`];
      if (res.skipped)
        parts.push(`${res.skipped} skipped (duplicate/unsupported)`);
      toast({ title: "Bank import complete", description: parts.join(" · ") });
      onImported?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (!bankId || selectedIds.size === 0) return;
    await runImport(Array.from(selectedIds));
  };

  const handleRandomImport = async () => {
    if (!bankId) return;
    const count = Number(randomCount);
    await runImport(undefined, {
      subject: subject.trim() || undefined,
      chapter: chapter.trim() || undefined,
      topic: topic.trim() || undefined,
      difficulty: difficulty || undefined,
      count: Number.isFinite(count) && count > 0 ? Math.floor(count) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Import from question bank</DialogTitle>
          <DialogDescription>
            Pick a Test Series question bank, then choose the questions to bring
            into this quiz. MCQ, true/false and drag-and-drop convert
            automatically; other types and duplicates are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {banksLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading banks…
            </div>
          ) : banks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No question banks found. Create one under Test Series → Question
              Banks first.
            </p>
          ) : (
            <Select value={bankId} onValueChange={handleBankChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a question bank" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {bankId && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search questions…"
                  className="h-9 pl-8 text-sm"
                />
              </div>

              {/* Shared-pool filters: narrow the pool by chapter/topic/etc. */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="h-8 text-xs"
                />
                <Input
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                  placeholder="Chapter"
                  className="h-8 text-xs"
                />
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Topic"
                  className="h-8 text-xs"
                />
                <Select
                  value={difficulty || "ANY"}
                  onValueChange={(v) => setDifficulty(v === "ANY" ? "" : v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Any difficulty</SelectItem>
                    <SelectItem value="EASY">Easy</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HARD">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Random pull from the filtered pool (chapter/topic randomization). */}
              <div className="flex items-center gap-2 rounded-md border border-dashed p-2">
                <span className="text-muted-foreground text-xs">
                  Pull random from filter:
                </span>
                <Input
                  type="number"
                  min={1}
                  value={randomCount}
                  onChange={(e) => setRandomCount(e.target.value)}
                  placeholder="N"
                  className="h-8 w-20 text-xs"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={importing || !Number(randomCount)}
                  onClick={handleRandomImport}
                >
                  {importing && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Import random
                </Button>
              </div>

              {questions.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2 px-1 text-sm">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  <span className="text-muted-foreground">
                    Select all{" "}
                    {total > questions.length
                      ? `(${questions.length} of ${total} shown)`
                      : `(${questions.length})`}
                  </span>
                </label>
              )}

              <div className="max-h-[320px] overflow-y-auto rounded-md border">
                {questionsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading
                    questions…
                  </div>
                ) : questions.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {debouncedSearch
                      ? "No questions match your search."
                      : "This bank has no questions."}
                  </p>
                ) : (
                  questions.map((q) => {
                    const checked = selectedIds.has(q.id);
                    return (
                      <label
                        key={q.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 border-b px-3 py-2 text-sm last:border-0 transition-colors",
                          checked ? "bg-primary/10" : "hover:bg-muted/40"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(q.id)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
                        />
                        <span className="flex-1 line-clamp-2">
                          {getStemPreview(q.stem) || "(no text)"}
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 px-1.5 py-0 text-[10px] font-normal"
                        >
                          {q.type}
                        </Badge>
                      </label>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedIds.size === 0 || importing}
          >
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selectedIds.size > 0
              ? `Import ${selectedIds.size} selected`
              : "Import selected"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BankImportDialog;
