"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
  useToast,
} from "@open-mtlms/core";
import {
  BookOpen,
  Check,
  Circle,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";

import {
  type BookAISectionKey,
  type GeneratedBookContent,
  type BookThumbnailContext,
  type SectionProgress,
  ALL_BOOK_AI_SECTION_KEYS,
} from "@/lib/api/book-ai";
import { useBookAIGeneration } from "@/lib/hooks/useBookAIGeneration";
import {
  extractTextFromFile,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/utils/file-to-text";

export interface BookAIGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookTitle: string;
  epubUrl?: string;
  onSuccess: (data: GeneratedBookContent, sections: BookAISectionKey[]) => void | Promise<void>;
  thumbnailContext?: BookThumbnailContext;
}

const SECTION_LABELS: Record<BookAISectionKey, string> = {
  description: "Book Description",
  thumbnail: "Book Cover",
};

export function BookAIGenerateModal({
  open,
  onOpenChange,
  bookTitle,
  epubUrl,
  onSuccess,
  thumbnailContext,
}: BookAIGenerateModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extraContext, setExtraContext] = useState("");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceFileContent, setReferenceFileContent] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Set<BookAISectionKey>>(new Set());

  const generation = useBookAIGeneration();

  // Reset form state when modal opens
  useEffect(() => {
    if (open) {
      setExtraContext("");
      setReferenceFile(null);
      setReferenceFileContent(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedSections(new Set(ALL_BOOK_AI_SECTION_KEYS));
      generation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Handle completion
  useEffect(() => {
    if (generation.state === "completed" && generation.result) {
      const result = generation.result as GeneratedBookContent;
      const sectionsArray = Array.from(selectedSections);

      // Check for partial failures
      const failedSections = generation.progress
        ? Object.entries(generation.progress.sections)
            .filter(([, sp]) => (sp as SectionProgress)?.status === "failed")
            .map(([key]) => key as BookAISectionKey)
        : [];

      const succeededSections = sectionsArray.filter(
        (s) => !failedSections.includes(s)
      );

      if (failedSections.length > 0 && succeededSections.length > 0) {
        toast({
          title: "Partially generated",
          description: `${succeededSections.length} sections generated. ${failedSections.length} failed, you can try generating them separately.`,
          variant: "default",
        });
      } else if (failedSections.length === 0) {
        toast({
          title: "Success",
          description: "Book content generated successfully!",
        });
      }

      if (succeededSections.length > 0) {
        void onSuccess(result, sectionsArray);
        onOpenChange(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation.state]);

  // Handle failure with no results
  useEffect(() => {
    if (generation.state === "failed" && !generation.result) {
      toast({
        title: "Generation failed",
        description: generation.error || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation.state]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setReferenceFile(null);
    setReferenceFileContent(null);

    try {
      const text = await extractTextFromFile(file, MAX_FILE_SIZE_BYTES);
      setReferenceFile(file);
      setReferenceFileContent(text);
    } catch (err) {
      toast({
        title: "File error",
        description: err instanceof Error ? err.message : "Failed to read file",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = () => {
    setReferenceFile(null);
    setReferenceFileContent(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleToggleSection = (key: BookAISectionKey) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleGenerate = useCallback(async () => {
    if (!bookTitle.trim()) {
      toast({
        title: "Book title required",
        description: "Please enter a book title first",
        variant: "destructive",
      });
      return;
    }

    if (selectedSections.size === 0) {
      toast({
        title: "No sections selected",
        description: "Please select at least one section to generate",
        variant: "destructive",
      });
      return;
    }

    await generation.submit({
      bookTitle: bookTitle.trim(),
      sections: Array.from(selectedSections),
      epubUrl: epubUrl || undefined,
      extraContext: extraContext.trim() || undefined,
      referenceDocument: referenceFileContent || undefined,
      thumbnailContext,
    });
  }, [
    bookTitle,
    selectedSections,
    epubUrl,
    extraContext,
    referenceFileContent,
    thumbnailContext,
    generation,
    toast,
  ]);

  const handleClose = (open: boolean) => {
    if (!open && generation.isActive) {
      generation.reset();
    }
    onOpenChange(open);
  };

  const showProgressView = generation.isActive || generation.state === "failed";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Book Content with AI
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            AI will generate a description and book cover based on the book
            title{epubUrl ? " and EPUB content. Author, language, and page count will also be extracted from the EPUB" : ""}.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
        {showProgressView ? (
          <GenerationProgress
            progress={generation.progress}
            selectedSections={Array.from(selectedSections)}
            error={generation.error}
            state={generation.state}
          />
        ) : (
          <div className="space-y-4 py-4">
            {/* Book Title (read-only) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Book Title</Label>
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                {bookTitle || (
                  <span className="italic text-muted-foreground">No title set</span>
                )}
              </div>
            </div>

            {/* EPUB Status */}
            <div className="space-y-2">
              {epubUrl ? (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-950/30">
                  <BookOpen className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    EPUB uploaded: AI will analyze the book content for better results
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
                  <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm text-amber-700 dark:text-amber-300">
                    No EPUB uploaded, upload an EPUB for better AI results
                  </span>
                </div>
              )}
            </div>

            {/* Section Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Sections to Generate</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_BOOK_AI_SECTION_KEYS.map((key) => {
                  const isChecked = selectedSections.has(key);
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors hover:bg-muted/50"
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isChecked}
                        onClick={() => handleToggleSection(key)}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          isChecked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background"
                        }`}
                      >
                        {isChecked && <Check className="h-3 w-3" />}
                      </button>
                      <span className="text-sm">{SECTION_LABELS[key]}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Extra Context */}
            <div className="space-y-2">
              <Label htmlFor="book-extra-context" className="text-sm font-medium">
                Additional Context{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <textarea
                id="book-extra-context"
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                placeholder="E.g., target readers, genre, key themes, author background..."
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Reference Document */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Reference Document{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.json,.pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={isExtracting}
              />
              {referenceFile ? (
                <div className="flex items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {referenceFile.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    ({(referenceFile.size / 1024).toFixed(1)} KB)
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={handleRemoveFile}
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isExtracting}
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Extracting text...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Choose file
                    </>
                  )}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Upload a table of contents, synopsis, or supplementary document.
                (TXT, MD, CSV, JSON, PDF, max 5MB)
              </p>
            </div>
          </div>
        )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={generation.state === "submitting"}
          >
            {generation.isActive ? "Close" : "Cancel"}
          </Button>
          {!showProgressView && (
            <Button
              onClick={handleGenerate}
              disabled={generation.isActive || !bookTitle.trim() || selectedSections.size === 0}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Progress Sub-Component ─────────────────────────────────────────────────

function GenerationProgress({
  progress,
  selectedSections,
  error,
  state,
}: {
  progress: {
    sections: Partial<Record<BookAISectionKey, SectionProgress>>;
    completedCount: number;
    totalCount: number;
    currentSection?: BookAISectionKey;
  } | null;
  selectedSections: BookAISectionKey[];
  error: string | null;
  state: string;
}) {
  const completedCount = progress?.completedCount ?? 0;
  const totalCount = progress?.totalCount ?? selectedSections.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4 py-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {state === "submitting"
              ? "Submitting..."
              : state === "failed" && completedCount === 0
                ? "Generation failed"
                : `${completedCount} of ${totalCount} sections`}
          </span>
          <span className="font-medium">{percentage}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Section list */}
      <div className="space-y-1.5">
        {selectedSections.map((key) => {
          const sp = progress?.sections?.[key];
          const sectionStatus = sp?.status ?? "pending";

          return (
            <div
              key={key}
              className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm"
            >
              <SectionStatusIcon status={sectionStatus} />
              <span
                className={
                  sectionStatus === "processing"
                    ? "font-medium"
                    : sectionStatus === "failed"
                      ? "text-destructive"
                      : sectionStatus === "completed"
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60"
                }
              >
                {SECTION_LABELS[key]}
              </span>
              {sectionStatus === "failed" && sp?.error && (
                <span className="ml-auto truncate text-xs text-destructive/70 max-w-[180px]">
                  {sp.error}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Global error */}
      {error && state === "failed" && completedCount === 0 && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Current section label */}
      {progress?.currentSection && state !== "failed" && state !== "completed" && (
        <p className="text-xs text-muted-foreground text-center">
          Generating {SECTION_LABELS[progress.currentSection].toLowerCase()}...
        </p>
      )}
    </div>
  );
}

function SectionStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Check className="h-4 w-4 shrink-0 text-green-600" />;
    case "processing":
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />;
    case "failed":
      return <X className="h-4 w-4 shrink-0 text-destructive" />;
    default:
      return <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />;
  }
}
