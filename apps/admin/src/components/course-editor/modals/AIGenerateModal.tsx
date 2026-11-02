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
  type CourseAISectionKey,
  type CourseMetadata,
  type GeneratedCourseContent,
  type ThumbnailContext,
  type SectionProgress,
  ALL_AI_SECTION_KEYS,
} from "@/lib/api/course-ai";
import { useCourseAIGeneration } from "@/lib/hooks/useCourseAIGeneration";
import {
  extractTextFromFile,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/utils/file-to-text";

export interface AIGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "all" | "section";
  sectionKey?: CourseAISectionKey;
  courseTitle: string;
  onSuccess: (data: GeneratedCourseContent, sections: CourseAISectionKey[]) => void | Promise<void>;
  thumbnailContext?: ThumbnailContext;
  courseMetadata?: CourseMetadata;
  /** Resolved LMS course ID, grounds generation in the actual uploaded curriculum. */
  lmsCourseId?: string | null;
}

const SECTION_LABELS: Record<CourseAISectionKey, string> = {
  subtitle: "Subtitle",
  learningOutcomes: "What You'll Learn",
  curriculum: "Course Content (Syllabus)",
  offerings: "This Course Includes",
  requirements: "Requirements",
  description: "Description",
  faqs: "Frequently Asked Questions",
  thumbnails: "Course Thumbnails",
};

export function AIGenerateModal({
  open,
  onOpenChange,
  mode,
  sectionKey,
  courseTitle,
  onSuccess,
  thumbnailContext,
  courseMetadata,
  lmsCourseId,
}: AIGenerateModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extraContext, setExtraContext] = useState("");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceFileContent, setReferenceFileContent] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Set<CourseAISectionKey>>(new Set());

  const generation = useCourseAIGeneration();

  // Reset form state when modal opens
  useEffect(() => {
    if (open) {
      setExtraContext("");
      setReferenceFile(null);
      setReferenceFileContent(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (mode === "all") {
        setSelectedSections(new Set(ALL_AI_SECTION_KEYS));
      } else if (sectionKey) {
        setSelectedSections(new Set([sectionKey]));
      }
      generation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, sectionKey]);

  // Handle completion
  useEffect(() => {
    if (generation.state === "completed" && generation.result) {
      const result = generation.result as GeneratedCourseContent;
      const sectionsArray = Array.from(selectedSections);

      // Check for partial failures
      const failedSections = generation.progress
        ? Object.entries(generation.progress.sections)
            .filter(([, sp]) => (sp as SectionProgress)?.status === "failed")
            .map(([key]) => key as CourseAISectionKey)
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
          description: "Content generated successfully!",
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

  const handleToggleSection = (key: CourseAISectionKey) => {
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
    if (!courseTitle.trim()) {
      toast({
        title: "Course title required",
        description: "Please enter a course title first",
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
      courseTitle: courseTitle.trim(),
      sections: Array.from(selectedSections),
      extraContext: extraContext.trim() || undefined,
      referenceDocument: referenceFileContent || undefined,
      thumbnailContext,
      courseMetadata,
      lmsCourseId: lmsCourseId ?? undefined,
    });
  }, [
    courseTitle,
    selectedSections,
    extraContext,
    referenceFileContent,
    thumbnailContext,
    courseMetadata,
    lmsCourseId,
    generation,
    toast,
  ]);

  const handleClose = (open: boolean) => {
    if (!open && generation.isActive) {
      generation.reset();
    }
    onOpenChange(open);
  };

  const isSingleSection = mode === "section" && sectionKey;
  const title = isSingleSection
    ? `Generate ${SECTION_LABELS[sectionKey]} with AI`
    : "Generate Course Content with AI";

  const showProgressView = generation.isActive || generation.state === "failed";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isSingleSection
              ? `AI will generate ${SECTION_LABELS[sectionKey].toLowerCase()} based on the course title.`
              : "AI will generate content for the selected sections based on the course title."}
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
            <div className="space-y-2">
              <Label className="text-sm font-medium">Course Title</Label>
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                {courseTitle || <span className="text-muted-foreground italic">No title set</span>}
              </div>
            </div>

            {mode === "all" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sections to Generate</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_AI_SECTION_KEYS.map((key) => {
                    const isChecked = selectedSections.has(key);
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isChecked}
                          onClick={() => handleToggleSection(key)}
                          className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                            isChecked
                              ? "bg-primary border-primary text-primary-foreground"
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
            )}

            <div className="space-y-2">
              <Label htmlFor="extra-context" className="text-sm font-medium">
                Additional Context{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                id="extra-context"
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                placeholder="E.g., target audience, key topics to cover, specific requirements, difficulty level..."
                rows={4}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                Provide any additional information to help generate more relevant content.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Reference Document{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
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
                  <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {referenceFile.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
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
                Upload a syllabus, outline, or document. AI will use it to structure
                and enhance the generated content. (TXT, MD, CSV, JSON, PDF, max 5MB)
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
              disabled={generation.isActive || !courseTitle.trim() || selectedSections.size === 0}
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
    sections: Partial<Record<CourseAISectionKey, SectionProgress>>;
    completedCount: number;
    totalCount: number;
    currentSection?: CourseAISectionKey;
  } | null;
  selectedSections: CourseAISectionKey[];
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
