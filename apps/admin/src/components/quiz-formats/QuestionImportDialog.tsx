"use client";

import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  TestQuestionDifficulty,
  TestQuestionStatus,
} from "@/lib/api/test-series";
import { uploadApi } from "@/lib/api/upload";
import {
  COURSE_QUIZ_SUPPORTED_TYPES,
  TEST_SERIES_SUPPORTED_TYPES,
  detectFormat,
  downloadTextFile,
  generateSampleCsv,
  generateSampleRows,
  looksLikeSheet,
  parseQuestions,
  parseSheet,
  type ParsedQuestion,
  type ParsedType,
  type QuizFormat,
} from "@/lib/quiz-formats";

export type ImportTarget = "TEST_SERIES" | "COURSE_QUIZ";

export interface ImportDefaults {
  marks: number;
  negativeMarks: number;
  difficulty: TestQuestionDifficulty;
  status: TestQuestionStatus;
  subject: string;
  chapter: string;
  topic: string;
}

export interface ImportConfirmResult {
  created: number;
  failed?: Array<{ index: number; error: string }>;
  /** Duplicates skipped during import (already in the bank or repeated in the file). */
  skipped?: number;
  duplicates?: Array<{ question: string; reason: string }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ImportTarget;
  /** Maps + sends the edited questions. Owns the mutation + cache invalidation. */
  onConfirm: (
    questions: ParsedQuestion[],
    defaults: ImportDefaults
  ) => Promise<ImportConfirmResult>;
  /**
   * Question-bank only: upload a Word .docx straight to the server AI import
   * (Word can't be parsed in the browser). When provided, a Word option + sample
   * appear and `.docx` uploads route here instead of the client-side parser.
   */
  onWordImport?: (file: File) => Promise<void>;
  /** Question-bank only: download the ready-to-fill Word template. */
  onDownloadWordSample?: () => void;
}

const TYPE_LABEL: Record<ParsedType, string> = {
  MCQ_SINGLE: "MCQ",
  MCQ_MULTI: "Multi",
  TRUE_FALSE: "True / False",
  FIB: "Fill blank",
  NAT: "Numerical",
  DRAG_DROP: "Drag & drop",
  DESCRIPTIVE: "Descriptive",
};

const AIKEN_SAMPLE = `What is the capital of France?
A. London
B. Paris
C. Berlin
D. Madrid
ANSWER: B`;

const GIFT_SAMPLE = `::Capital:: What is the capital of France? {
=Paris
~London
~Berlin
}

Water boils at 100 C at sea level. {TRUE}

The chemical symbol for gold is {=Au}.

2 + 2 equals {#4:0}.`;

const SHEET_SAMPLE_CSV = generateSampleCsv();

// Bulk image import: images referenced by filename in the sheet are uploaded
// from files the admin selects (individually or inside a .zip), then wired to
// the stem / option as URLs. A full https URL in a cell is used as-is.
const IMG_EXT_RE = /\.(png|jpe?g|gif|webp|svg)$/i;
const MAX_IMPORT_IMAGES = 300;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const isImageUrl = (s?: string): boolean =>
  !!s && /^https?:\/\//i.test(s.trim());

function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

/** Formats the input view can resolve to; SHEET = CSV / Excel, AI_FILE =
 *  PDF/Word/Excel extracted by the server AI (both test series only). */
type InputFormat = "AUTO" | QuizFormat | "SHEET" | "AI_FILE";

const DEFAULT_STATE: ImportDefaults = {
  marks: 4,
  negativeMarks: 1,
  difficulty: "MEDIUM",
  status: "DRAFT",
  subject: "",
  chapter: "",
  topic: "",
};

interface ReviewRow {
  key: string;
  q: ParsedQuestion;
}

function cloneQuestion(q: ParsedQuestion): ParsedQuestion {
  return {
    ...q,
    options: q.options.map((o) => ({ ...o })),
    textAnswers: q.textAnswers ? [...q.textAnswers] : undefined,
    numericAnswer: q.numericAnswer ? { ...q.numericAnswer } : undefined,
    warnings: [...q.warnings],
  };
}

function snippet(text: string, max = 90): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

export function QuestionImportDialog({
  open,
  onOpenChange,
  target,
  onConfirm,
  onWordImport,
  onDownloadWordSample,
}: Props) {
  const { toast } = useToast();
  const supportedTypes =
    target === "TEST_SERIES"
      ? TEST_SERIES_SUPPORTED_TYPES
      : COURSE_QUIZ_SUPPORTED_TYPES;
  const targetLabel =
    target === "TEST_SERIES" ? "question bank" : "course quiz";

  const [view, setView] = useState<"input" | "review">("input");
  const [format, setFormat] = useState<InputFormat>("AUTO");
  const [rawText, setRawText] = useState("");
  const [defaults, setDefaults] = useState<ImportDefaults>(DEFAULT_STATE);
  const [showExamples, setShowExamples] = useState(false);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [aiUploading, setAiUploading] = useState(false);
  const [imageFiles, setImageFiles] = useState<Map<string, File>>(new Map());
  const [imgUploading, setImgUploading] = useState(false);
  const [imgProgress, setImgProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const keySeq = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setView("input");
      setFormat("AUTO");
      setRawText("");
      setDefaults(DEFAULT_STATE);
      setShowExamples(false);
      setReviewRows([]);
      setSubmitting(false);
      setAiUploading(false);
      setImageFiles(new Map());
      setImgUploading(false);
      setImgProgress(null);
    }
  }, [open]);

  // AUTO: AIKEN/GIFT detection first, then (test series only) the CSV header
  // sniff, so spreadsheet pastes resolve without an explicit format pick.
  const resolvedFormat: QuizFormat | "SHEET" | null =
    format === "AI_FILE"
      ? null
      : format === "AUTO"
        ? detectFormat(rawText) ??
          (target === "TEST_SERIES" && looksLikeSheet(rawText) ? "SHEET" : null)
        : format;

  // CSV / Excel ("sheet") uploads import directly: no editable raw-text box and
  // no per-question review/mapping step. That editing flow exists only for the
  // AIKEN / GIFT paste formats, where fixing parsed text by hand is expected.
  const isSheet = format === "SHEET";
  // PDF / Word / Excel handed to the server AI (onWordImport). No client parse,
  // no review, the upload itself runs the import.
  const isAiFile = format === "AI_FILE";

  const parseResult = useMemo(() => {
    if (!rawText.trim() || !resolvedFormat) {
      return { questions: [] as ParsedQuestion[], errors: [] };
    }
    return resolvedFormat === "SHEET"
      ? parseSheet(rawText)
      : parseQuestions(rawText, resolvedFormat);
  }, [rawText, resolvedFormat]);

  const supported = parseResult.questions.filter((q) =>
    supportedTypes.has(q.type)
  );
  const unsupported = parseResult.questions.filter(
    (q) => !supportedTypes.has(q.type)
  );
  const skippedCount = parseResult.errors.length + unsupported.length;

  // Bulk image import (CSV / Excel only): image filenames the sheet references
  // that are not already full URLs. Each must be supplied as an uploaded file
  // before the import can run.
  const referencedImages = useMemo(() => {
    const names = new Set<string>();
    if (!isSheet) return names;
    for (const q of supported) {
      if (q.stemImage && !isImageUrl(q.stemImage)) names.add(q.stemImage.trim());
      for (const o of q.options) {
        if (o.image && !isImageUrl(o.image)) names.add(o.image.trim());
      }
    }
    return names;
  }, [isSheet, supported]);

  const missingImages = useMemo(
    () => [...referencedImages].filter((n) => !imageFiles.has(n)),
    [referencedImages, imageFiles]
  );
  const unusedImages = useMemo(
    () => [...imageFiles.keys()].filter((n) => !referencedImages.has(n)),
    [imageFiles, referencedImages]
  );

  // PDF / Word / Excel → server AI extraction. The parent (onWordImport) toasts
  // the result; we just show the spinner and close on completion.
  const handleAiUpload = async (file: File | undefined) => {
    if (!file || !onWordImport) return;
    setAiUploading(true);
    try {
      await onWordImport(file);
      onOpenChange(false);
    } finally {
      setAiUploading(false);
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".docx") && onWordImport) {
      // Word is binary + rich; the server (AI) extracts the questions. Close on
      // completion, the caller shows its own success/error toast.
      void onWordImport(file).then(() => onOpenChange(false));
      return;
    }
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      // Excel is binary: convert the first sheet to CSV so the rest of the
      // dialog keeps its single text-based parse path. SheetJS is loaded
      // lazily; it's only needed here and for the sample download.
      void (async () => {
        try {
          const buf = await file.arrayBuffer();
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(buf);
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          setRawText(sheet ? XLSX.utils.sheet_to_csv(sheet) : "");
          setFormat("SHEET");
        } catch {
          toast({
            title: "Could not read the Excel file",
            description: "Export the sheet as CSV and try again.",
            variant: "destructive",
          });
        }
      })();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawText(String(reader.result ?? ""));
      if (name.endsWith(".csv")) setFormat("SHEET");
    };
    reader.readAsText(file);
  };

  const downloadSampleXlsx = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(generateSampleRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    XLSX.writeFile(wb, "question-import-sample.xlsx");
  };

  // Add image files (individually or inside a .zip) to the filename -> File map
  // used to resolve sheet image references at import time.
  const addImageFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const next = new Map(imageFiles);
    let tooLarge = 0;
    let notImage = 0;
    for (const f of files) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith(".zip")) {
        try {
          // SheetJS bundles a ZIP reader (CFB.read detects the PK signature).
          const XLSX = await import("xlsx");
          const buf = new Uint8Array(await f.arrayBuffer());
          const container = XLSX.CFB.read(buf, { type: "array" }) as {
            FullPaths: string[];
            FileIndex: Array<{ type: number; content?: ArrayLike<number> }>;
          };
          const entries: Array<[string, Uint8Array]> = [];
          container.FileIndex.forEach((entry, i) => {
            if (entry.type !== 2 || !entry.content) return;
            entries.push([container.FullPaths[i] ?? "", Uint8Array.from(entry.content)]);
          });
          for (const [path, data] of entries) {
            if (path.endsWith("/") || path.includes("__MACOSX")) continue;
            const base = path.split("/").pop() ?? path;
            if (!base || base.startsWith(".")) continue;
            if (!IMG_EXT_RE.test(base)) {
              notImage++;
              continue;
            }
            if (data.byteLength > MAX_IMAGE_BYTES) {
              tooLarge++;
              continue;
            }
            // Copy into a fresh ArrayBuffer-backed array so the File part is a
            // plain BlobPart.
            next.set(
              base,
              new File([new Uint8Array(data)], base, {
                type: mimeFromName(base),
              })
            );
          }
        } catch {
          toast({
            title: "Could not read the .zip file",
            description: "Re-zip the images and try again.",
            variant: "destructive",
          });
        }
      } else if (IMG_EXT_RE.test(lower)) {
        if (f.size > MAX_IMAGE_BYTES) {
          tooLarge++;
          continue;
        }
        next.set(f.name, f);
      } else {
        notImage++;
      }
    }
    if (next.size > MAX_IMPORT_IMAGES) {
      toast({
        title: "Too many images",
        description: `The limit is ${MAX_IMPORT_IMAGES} images per import.`,
        variant: "destructive",
      });
      return;
    }
    setImageFiles(next);
    if (tooLarge || notImage) {
      const parts: string[] = [];
      if (tooLarge) parts.push(`${tooLarge} over 5 MB`);
      if (notImage) parts.push(`${notImage} not an image`);
      toast({ title: "Some files were skipped", description: parts.join(" · ") });
    }
  };

  const removeImage = (name: string) =>
    setImageFiles((prev) => {
      const next = new Map(prev);
      next.delete(name);
      return next;
    });

  const clearImages = () => setImageFiles(new Map());

  // CSV / Excel import: upload every referenced image once, then wire the URLs
  // onto the stem / options before handing the questions to onConfirm.
  const handleSheetImport = async () => {
    if (missingImages.length > 0) {
      toast({
        title: "Missing images",
        description: `Add ${missingImages.length} referenced image${
          missingImages.length === 1 ? "" : "s"
        } before importing.`,
        variant: "destructive",
      });
      return;
    }
    const names = [...referencedImages];
    const urlByName = new Map<string, string>();
    if (names.length > 0) {
      setImgUploading(true);
      setImgProgress({ done: 0, total: names.length });
      try {
        const CONCURRENCY = 5;
        for (let i = 0; i < names.length; i += CONCURRENCY) {
          const batch = names.slice(i, i + CONCURRENCY);
          const results = await Promise.all(
            batch.map(async (name) => {
              const file = imageFiles.get(name)!;
              const res = await uploadApi.uploadFile(file, "test-questions");
              return [name, res.url] as const;
            })
          );
          results.forEach(([n, u]) => urlByName.set(n, u));
          setImgProgress({
            done: Math.min(i + CONCURRENCY, names.length),
            total: names.length,
          });
        }
      } catch (err) {
        setImgUploading(false);
        setImgProgress(null);
        toast({
          title: "Image upload failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
        return;
      }
      setImgUploading(false);
      setImgProgress(null);
    }
    const resolveOne = (ref?: string): string | undefined => {
      const t = ref?.trim();
      if (!t) return undefined;
      return isImageUrl(t) ? t : urlByName.get(t);
    };
    const resolved = supported.map((q) => {
      const c = cloneQuestion(q);
      c.stemImageUrl = resolveOne(q.stemImage);
      c.options = q.options.map((o) => ({ ...o, imageUrl: resolveOne(o.image) }));
      return c;
    });
    await doImport(resolved);
  };

  const goToReview = () => {
    setReviewRows(
      supported.map((q) => ({ key: `r-${keySeq.current++}`, q: cloneQuestion(q) }))
    );
    setView("review");
  };

  const updateRow = (key: string, q: ParsedQuestion) =>
    setReviewRows((prev) => prev.map((r) => (r.key === key ? { ...r, q } : r)));

  const removeRow = (key: string) =>
    setReviewRows((prev) => prev.filter((r) => r.key !== key));

  const doImport = async (rawQuestions: ParsedQuestion[]) => {
    const questions = rawQuestions.filter(
      (q) =>
        q.stem.trim().length > 0 ||
        !!q.stemImage?.trim() ||
        !!q.stemImageUrl?.trim()
    );
    if (questions.length === 0) {
      toast({
        title: "Nothing to import",
        description: "Add at least one question with text or an image.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const result = await onConfirm(questions, defaults);
      const failedCount = result.failed?.length ?? 0;
      const dupCount = result.skipped ?? 0;
      const parts: string[] = [];
      if (dupCount)
        parts.push(`${dupCount} duplicate${dupCount === 1 ? "" : "s"} skipped`);
      if (failedCount)
        parts.push(`${failedCount} could not be imported (see format)`);
      toast({
        title: `${result.created} question${result.created === 1 ? "" : "s"} imported`,
        description: parts.length ? parts.join(" · ") : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Review flow (AIKEN / GIFT): import the edited rows.
  const handleImport = () => doImport(reviewRows.map((r) => r.q));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[760px] flex-col p-0 overflow-hidden sm:rounded-lg">
        <DialogHeader className="px-5 py-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileUp className="h-4 w-4 text-primary" />
            Import questions
            <span className="ml-1 font-normal text-xs text-muted-foreground">
              {view === "input"
                ? target === "TEST_SERIES"
                  ? onWordImport
                    ? "Paste or upload AIKEN / GIFT / CSV / Excel / PDF / Word"
                    : "Paste or upload AIKEN / GIFT / CSV / Excel content"
                  : "Paste or upload AIKEN / GIFT content"
                : "Review and edit before importing"}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Import questions from AIKEN, GIFT or spreadsheet content into this{" "}
            {targetLabel}.
          </DialogDescription>
        </DialogHeader>

        {view === "input" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="px-5 py-3 space-y-3 min-h-0 flex-1 overflow-y-auto">
              {/* format + upload row */}
              <div className="flex items-center gap-2">
                <div className="w-44">
                  <Select
                    value={format}
                    onValueChange={(v) => setFormat(v as InputFormat)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTO">
                        Auto-detect
                        {format === "AUTO" && resolvedFormat
                          ? ` (${resolvedFormat === "SHEET" ? "CSV" : resolvedFormat})`
                          : ""}
                      </SelectItem>
                      <SelectItem value="AIKEN">AIKEN</SelectItem>
                      <SelectItem value="GIFT">GIFT (Moodle)</SelectItem>
                      {target === "TEST_SERIES" && (
                        <SelectItem value="SHEET">CSV / Excel</SelectItem>
                      )}
                      {target === "TEST_SERIES" && onWordImport && (
                        <SelectItem value="AI_FILE">
                          PDF / Word / Excel (AI)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={
                    isAiFile
                      ? ".pdf,.docx,.xlsx,.xls"
                      : target === "TEST_SERIES"
                        ? ".txt,.csv,.xlsx,.xls,text/plain,text/csv"
                        : ".txt,text/plain"
                  }
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (isAiFile) void handleAiUpload(f);
                    else handleFile(f);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*,.zip"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void addImageFiles(Array.from(e.target.files ?? []));
                    if (imageInputRef.current) imageInputRef.current.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {target === "TEST_SERIES" ? "Upload file" : "Upload .txt"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setShowExamples((v) => !v)}
                >
                  <ChevronDown
                    className={cn(
                      "mr-1.5 h-3.5 w-3.5 transition-transform",
                      showExamples && "rotate-180"
                    )}
                  />
                  {showExamples ? "Hide examples" : "Format examples & samples"}
                </Button>
              </div>

              {showExamples && (
                <div className="space-y-2 text-xs">
                  <SampleRow
                    title="AIKEN"
                    onDownload={() =>
                      downloadTextFile("aiken-sample.txt", AIKEN_SAMPLE)
                    }
                    onUse={() => {
                      setFormat("AIKEN");
                      setRawText(AIKEN_SAMPLE);
                    }}
                  />
                  <SampleRow
                    title="GIFT (Moodle)"
                    onDownload={() =>
                      downloadTextFile("gift-sample.txt", GIFT_SAMPLE)
                    }
                    onUse={() => {
                      setFormat("GIFT");
                      setRawText(GIFT_SAMPLE);
                    }}
                  />
                  {target === "TEST_SERIES" && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                      <span className="font-medium">
                        CSV / Excel (all question types)
                      </span>
                      <div className="flex items-center gap-3 text-[11px]">
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() =>
                            downloadTextFile(
                              "question-import-sample.csv",
                              SHEET_SAMPLE_CSV
                            )
                          }
                        >
                          Download .csv
                        </button>
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => void downloadSampleXlsx()}
                        >
                          Download .xlsx
                        </button>
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => {
                            setFormat("SHEET");
                            setRawText(SHEET_SAMPLE_CSV);
                          }}
                        >
                          Use sample
                        </button>
                      </div>
                    </div>
                  )}
                  {target === "TEST_SERIES" && onDownloadWordSample && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                      <span className="font-medium">PDF / Word / Excel (AI)</span>
                      <button
                        type="button"
                        className="text-[11px] text-primary hover:underline"
                        onClick={onDownloadWordSample}
                      >
                        Download sample.docx
                      </button>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Download a sample to see the exact format, then paste or
                    upload your file.
                  </p>
                </div>
              )}

              {/* AIKEN / GIFT: editable paste box. CSV / Excel imports directly
                  from the file, so no editable text box is shown. */}
              {isAiFile && (
                <div className="rounded-md border border-dashed p-8 text-center text-xs text-muted-foreground">
                  {aiUploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Reading the file and extracting questions...
                    </span>
                  ) : (
                    <>
                      <p>
                        Upload a PDF, Word or Excel file: AI reads it and
                        extracts the questions automatically.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-1.5 h-3.5 w-3.5" />
                        Choose file
                      </Button>
                    </>
                  )}
                </div>
              )}

              {!isSheet && !isAiFile && (
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={
                    target === "TEST_SERIES"
                      ? "Paste AIKEN or GIFT content here, or upload a .txt file. For CSV / Excel, use Upload file above."
                      : "Paste AIKEN or GIFT content here, or upload a .txt file..."
                  }
                  className="min-h-[200px] font-mono text-xs"
                />
              )}

              {isSheet && (
                rawText.trim() ? (
                  <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                    Spreadsheet loaded. Questions import exactly as written in the
                    sheet, so there is no per-question editing for CSV / Excel.
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                    Upload a CSV or Excel file (or use the sample above) to load
                    questions.
                  </div>
                )
              )}

              {rawText.trim() && !resolvedFormat && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Could not detect a format. Pick{" "}
                  {target === "TEST_SERIES"
                    ? "AIKEN, GIFT or CSV / Excel"
                    : "AIKEN or GIFT"}{" "}
                  above.
                </p>
              )}

              {resolvedFormat && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="font-normal">
                    {supported.length} ready
                  </Badge>
                  {skippedCount > 0 && (
                    <Badge
                      variant="outline"
                      className="font-normal text-amber-600 border-amber-300"
                    >
                      {skippedCount} skipped
                    </Badge>
                  )}
                </div>
              )}

              {(unsupported.length > 0 || parseResult.errors.length > 0) && (
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-2 space-y-1 text-xs">
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    Skipped
                  </p>
                  {unsupported.map((q, i) => (
                    <p key={`u-${i}`} className="text-amber-700/90 dark:text-amber-300/80">
                      {TYPE_LABEL[q.type]} not supported in a {targetLabel}:{" "}
                      <span className="opacity-80">{snippet(q.stem, 60)}</span>
                    </p>
                  ))}
                  {parseResult.errors.map((e, i) => (
                    <p key={`e-${i}`} className="text-amber-700/90 dark:text-amber-300/80">
                      {e.message}: <span className="opacity-80">{snippet(e.block, 60)}</span>
                    </p>
                  ))}
                </div>
              )}
              {/* CSV / Excel: apply-to-all settings (Status etc.) live here,
                  since there is no review step. */}
              {isSheet && supported.length > 0 && (
                <div className="space-y-1.5">
                  <DefaultsBar
                    target={target}
                    defaults={defaults}
                    setDefaults={setDefaults}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    These apply only where a sheet cell is blank; values in the
                    sheet take precedence. Status applies to all imported questions.
                  </p>
                </div>
              )}

              {/* Bulk image import: shown when the sheet references image files
                  (QuestionImage / OptionNImage). Full URLs need no upload. */}
              {isSheet && referencedImages.size > 0 && (
                <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium">
                      <ImageIcon className="h-3.5 w-3.5 text-primary" />
                      Question images
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => imageInputRef.current?.click()}
                      >
                        <Upload className="mr-1.5 h-3.5 w-3.5" />
                        Add images or .zip
                      </Button>
                      {imageFiles.size > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearImages}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {referencedImages.size} image
                    {referencedImages.size === 1 ? "" : "s"} referenced ·{" "}
                    {imageFiles.size} added. Filenames must match the sheet exactly.
                  </p>
                  {missingImages.length > 0 ? (
                    <p className="flex items-start gap-1.5 text-[11px] text-destructive">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Missing {missingImages.length}:{" "}
                        {missingImages.slice(0, 8).join(", ")}
                        {missingImages.length > 8
                          ? ` +${missingImages.length - 8} more`
                          : ""}
                      </span>
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-[11px] text-green-600">
                      <Check className="h-3.5 w-3.5" />
                      All referenced images are ready.
                    </p>
                  )}
                  {unusedImages.length > 0 && (
                    <p className="text-[11px] text-amber-600">
                      {unusedImages.length} added image
                      {unusedImages.length === 1 ? "" : "s"} not referenced by the
                      sheet (ignored).
                    </p>
                  )}
                  {imageFiles.size > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[...imageFiles.keys()].slice(0, 24).map((name) => (
                        <span
                          key={name}
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
                            referencedImages.has(name)
                              ? "border-input"
                              : "border-amber-300 text-amber-700"
                          )}
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() => removeImage(name)}
                            aria-label={`Remove ${name}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                      {imageFiles.size > 24 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{imageFiles.size - 24} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
              <span className="text-xs text-muted-foreground">
                {isAiFile
                  ? "AI reads the file and imports the questions directly."
                  : isSheet
                    ? "Questions import directly from the sheet."
                    : "Defaults and per-question edits come next."}
              </span>
              {isAiFile ? null : isSheet ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    submitting ||
                    imgUploading ||
                    supported.length === 0 ||
                    missingImages.length > 0
                  }
                  onClick={() => void handleSheetImport()}
                >
                  {imgUploading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Uploading images {imgProgress?.done ?? 0}/
                      {imgProgress?.total ?? 0}
                    </>
                  ) : submitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Import {supported.length > 0 ? supported.length : ""} question
                      {supported.length === 1 ? "" : "s"}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={supported.length === 0}
                  onClick={goToReview}
                >
                  Review {supported.length > 0 ? supported.length : ""} question
                  {supported.length === 1 ? "" : "s"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="px-5 py-3 space-y-3 min-h-0 flex-1 overflow-y-auto">
              <DefaultsBar
                target={target}
                defaults={defaults}
                setDefaults={setDefaults}
              />
              <div className="space-y-3">
                {reviewRows.map((row, idx) => (
                  <ReviewQuestionCard
                    key={row.key}
                    index={idx}
                    q={row.q}
                    onChange={(q) => updateRow(row.key, q)}
                    onRemove={() => removeRow(row.key)}
                  />
                ))}
                {reviewRows.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">
                    No questions to review.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setView("input")}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={submitting || reviewRows.length === 0}
                onClick={handleImport}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Import {reviewRows.length} question
                    {reviewRows.length === 1 ? "" : "s"}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SampleRow({
  title,
  onDownload,
  onUse,
}: {
  title: string;
  onDownload: () => void;
  onUse: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
      <span className="font-medium">{title}</span>
      <div className="flex items-center gap-3 text-[11px]">
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={onDownload}
        >
          Download sample
        </button>
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={onUse}
        >
          Use sample
        </button>
      </div>
    </div>
  );
}

function DefaultsBar({
  target,
  defaults,
  setDefaults,
}: {
  target: ImportTarget;
  defaults: ImportDefaults;
  setDefaults: React.Dispatch<React.SetStateAction<ImportDefaults>>;
}) {
  const set = (patch: Partial<ImportDefaults>) =>
    setDefaults((prev) => ({ ...prev, ...patch }));

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Applied to every imported question
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Marks">
          <Input
            type="number"
            step="0.5"
            value={String(defaults.marks)}
            onChange={(e) => set({ marks: parseFloat(e.target.value) || 0 })}
            className="h-8 w-20"
          />
        </Field>
        {target === "TEST_SERIES" && (
          <>
            <Field label="Negative">
              <Input
                type="number"
                step="0.5"
                value={String(defaults.negativeMarks)}
                onChange={(e) =>
                  set({ negativeMarks: parseFloat(e.target.value) || 0 })
                }
                className="h-8 w-20"
              />
            </Field>
            <Field label="Difficulty">
              <Select
                value={defaults.difficulty}
                onValueChange={(v) =>
                  set({ difficulty: v as TestQuestionDifficulty })
                }
              >
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EASY">Easy</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HARD">Hard</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={defaults.status}
                onValueChange={(v) => set({ status: v as TestQuestionStatus })}
              >
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Subject">
              <Input
                value={defaults.subject}
                onChange={(e) => set({ subject: e.target.value })}
                className="h-8 w-28"
                placeholder="optional"
              />
            </Field>
            <Field label="Chapter">
              <Input
                value={defaults.chapter}
                onChange={(e) => set({ chapter: e.target.value })}
                className="h-8 w-28"
                placeholder="optional"
              />
            </Field>
            <Field label="Topic">
              <Input
                value={defaults.topic}
                onChange={(e) => set({ topic: e.target.value })}
                className="h-8 w-28"
                placeholder="optional"
              />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ReviewQuestionCard({
  index,
  q,
  onChange,
  onRemove,
}: {
  index: number;
  q: ParsedQuestion;
  onChange: (q: ParsedQuestion) => void;
  onRemove: () => void;
}) {
  const setStem = (stem: string) => onChange({ ...q, stem });

  const toggleCorrect = (optIdx: number) => {
    const single =
      q.type === "MCQ_SINGLE" ||
      q.type === "TRUE_FALSE" ||
      q.type === "DRAG_DROP";
    const options = q.options.map((o, i) => ({
      ...o,
      isCorrect: single ? i === optIdx : i === optIdx ? !o.isCorrect : o.isCorrect,
    }));
    onChange({ ...q, options });
  };

  const setOptionText = (optIdx: number, label: string) =>
    onChange({
      ...q,
      options: q.options.map((o, i) => (i === optIdx ? { ...o, label } : o)),
    });

  const addOption = () =>
    onChange({ ...q, options: [...q.options, { label: "", isCorrect: false }] });

  const removeOption = (optIdx: number) =>
    onChange({ ...q, options: q.options.filter((_, i) => i !== optIdx) });

  const isMcq =
    q.type === "MCQ_SINGLE" ||
    q.type === "MCQ_MULTI" ||
    q.type === "DRAG_DROP";
  const missingBlank = q.type === "DRAG_DROP" && !q.stem.includes("___");

  return (
    <div className="rounded-lg border bg-background p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="mt-2 text-xs font-medium text-muted-foreground tabular-nums">
          {index + 1}.
        </span>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] font-normal">
              {TYPE_LABEL[q.type]}
            </Badge>
            {q.warnings.map((w, i) => (
              <span key={i} className="text-[10px] text-amber-600">
                {w}
              </span>
            ))}
          </div>
          <Textarea
            value={q.stem}
            onChange={(e) => setStem(e.target.value)}
            rows={2}
            className="resize-none text-sm"
            placeholder="Question text..."
          />
          {missingBlank && (
            <p className="flex items-center gap-1 text-[11px] text-amber-600">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Stem must contain &quot;___&quot; (three underscores) to mark the
              blank.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove question"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="pl-6 space-y-1.5">
        {(q.type === "MCQ_SINGLE" ||
          q.type === "MCQ_MULTI" ||
          q.type === "TRUE_FALSE" ||
          q.type === "DRAG_DROP") &&
          q.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleCorrect(i)}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center border transition-colors",
                  q.type === "MCQ_MULTI" ? "rounded" : "rounded-full",
                  o.isCorrect
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-input text-transparent hover:border-green-600/50"
                )}
                aria-label={o.isCorrect ? "Marked correct" : "Mark correct"}
              >
                <Check className="h-3 w-3" />
              </button>
              <Input
                value={o.label}
                onChange={(e) => setOptionText(i, e.target.value)}
                className="h-8 flex-1 text-sm"
                placeholder="Option text..."
                disabled={q.type === "TRUE_FALSE"}
              />
              {isMcq && q.options.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeOption(i)}
                  aria-label="Remove option"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}

        {isMcq && q.options.length < 8 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={addOption}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add option
          </Button>
        )}

        {q.type === "FIB" && (
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              Correct answer
            </Label>
            <Input
              value={q.textAnswers?.[0] ?? ""}
              onChange={(e) =>
                onChange({ ...q, textAnswers: [e.target.value] })
              }
              className="h-8 text-sm"
              placeholder="Canonical answer (case-insensitive)"
            />
          </div>
        )}

        {q.type === "NAT" && (
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Answer</Label>
              <Input
                type="number"
                value={String(q.numericAnswer?.value ?? 0)}
                onChange={(e) =>
                  onChange({
                    ...q,
                    numericAnswer: {
                      value: parseFloat(e.target.value) || 0,
                      tolerance: q.numericAnswer?.tolerance ?? 0,
                    },
                  })
                }
                className="h-8 w-28 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Tolerance (±)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={String(q.numericAnswer?.tolerance ?? 0)}
                onChange={(e) =>
                  onChange({
                    ...q,
                    numericAnswer: {
                      value: q.numericAnswer?.value ?? 0,
                      tolerance: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="h-8 w-28 text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
