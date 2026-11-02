"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@open-mtlms/core";
import { CheckCircle2, FileText, Loader2, Upload, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  useSubmitTestAIGeneration,
  useTestAIJobStatus,
} from "@/lib/hooks/use-test-series";
import type { TestQuestionType } from "@/lib/api/test-series";
import { cn } from "@/lib/utils";

interface Props {
  bankId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once questions land, caller can refetch the question list. */
  onCompleted?: (savedCount: number) => void;
}

const ALL_TYPES: { value: TestQuestionType; label: string }[] = [
  { value: "MCQ_SINGLE", label: "MCQ (single)" },
  { value: "MCQ_MULTI", label: "MCQ (multi)" },
  { value: "TRUE_FALSE", label: "True / False" },
  { value: "FIB", label: "Fill in the blank" },
  { value: "NAT", label: "Numerical" },
];

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export function AIGenerateModal({ bankId, open, onOpenChange, onCompleted }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [count, setCount] = useState<number>(20);
  const [types, setTypes] = useState<TestQuestionType[]>(["MCQ_SINGLE"]);
  const [easy, setEasy] = useState<number>(33);
  const [medium, setMedium] = useState<number>(34);
  const [hard, setHard] = useState<number>(33);
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [completedNotified, setCompletedNotified] = useState(false);

  const submit = useSubmitTestAIGeneration();
  const { data: jobStatus } = useTestAIJobStatus(jobId, {
    enabled: !!jobId,
    pollIntervalMs: 2000,
  });

  const mixSum = easy + medium + hard;
  const mixValid = mixSum === 100;
  const canSubmit =
    !!file &&
    count >= 5 &&
    count <= 50 &&
    types.length > 0 &&
    mixValid &&
    !submit.isPending &&
    !jobId;

  // Notify parent on first transition to completed
  useEffect(() => {
    if (!jobStatus || completedNotified) return;
    if (jobStatus.state === "completed") {
      const saved = jobStatus.progress?.questionsSaved ?? 0;
      toast({
        title: "Questions ready",
        description: `Generated ${saved} questions. Ready to use.`,
      });
      setCompletedNotified(true);
      onCompleted?.(saved);
    } else if (jobStatus.state === "failed") {
      toast({
        title: "Generation failed",
        description:
          jobStatus.failedReason ?? jobStatus.progress?.error ?? "Unknown error",
        variant: "destructive",
      });
      setCompletedNotified(true);
    }
  }, [jobStatus, completedNotified, toast, onCompleted]);

  const reset = () => {
    setFile(null);
    setJobId(null);
    setCompletedNotified(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      // Reset only if not in the middle of an active job
      const inProgress =
        jobStatus &&
        ["waiting", "active", "delayed"].includes(jobStatus.state);
      if (!inProgress) reset();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Maximum size is 100 MB.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    if (f && f.type !== "application/pdf") {
      toast({
        title: "PDF only",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    setFile(f);
  };

  const toggleType = (t: TestQuestionType) => {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const handleSubmit = () => {
    if (!file) return;
    submit.mutate(
      {
        bankId,
        file,
        config: {
          count,
          types,
          difficultyMix: { easy, medium, hard },
          language,
          subject: subject.trim() || null,
          chapter: chapter.trim() || null,
          topic: topic.trim() || null,
        },
      },
      {
        onSuccess: ({ jobId: id }) => {
          setJobId(id);
        },
        onError: (err) => {
          toast({
            title: "Could not start generation",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      }
    );
  };

  const progressLabel = useMemo(() => {
    if (!jobStatus) return "Queued…";
    const p = jobStatus.progress;
    if (jobStatus.state === "completed")
      return `Done. Saved ${p?.questionsSaved ?? 0} questions.`;
    if (jobStatus.state === "failed")
      return `Failed: ${jobStatus.failedReason ?? p?.error ?? "Unknown error"}`;
    if (!p) return "Queued…";
    if (p.status === "extracting") return "Extracting text from PDF…";
    if (p.status === "generating")
      return `Generating questions (${p.chunksDone ?? 0}/${p.chunksTotal ?? "?"} chunks · ${p.questionsGenerated ?? 0} so far)…`;
    if (p.status === "saving") return "Saving questions…";
    if (p.status === "completed") return `Done. Saved ${p.questionsSaved ?? 0}.`;
    return p.status;
  }, [jobStatus]);

  const progressPct = useMemo(() => {
    const p = jobStatus?.progress;
    if (!p) return 5;
    if (p.status === "extracting") return 15;
    if (p.status === "generating" && p.chunksTotal && p.chunksTotal > 0) {
      const base = 20;
      const span = 70;
      return base + Math.round((span * (p.chunksDone ?? 0)) / p.chunksTotal);
    }
    if (p.status === "saving") return 95;
    if (p.status === "completed") return 100;
    return 10;
  }, [jobStatus]);

  const isRunning =
    !!jobStatus &&
    ["waiting", "active", "delayed"].includes(jobStatus.state) &&
    jobStatus.progress?.status !== "completed";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Generate questions with AI</DialogTitle>
          <DialogDescription>
            Upload a PDF and we&apos;ll generate ready-to-use questions.
          </DialogDescription>
        </DialogHeader>

        {!jobId ? (
          <div className="space-y-4">
            {/* File upload */}
            <div className="space-y-2">
              <Label htmlFor="ai-pdf">Source PDF</Label>
              <input
                ref={fileInputRef}
                id="ai-pdf"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-input hover:bg-muted/40 flex w-full items-center justify-between gap-3 rounded-md border border-dashed px-4 py-3 text-left text-sm transition-colors"
              >
                <span className="flex items-center gap-3">
                  {file ? (
                    <FileText className="text-foreground h-4 w-4" />
                  ) : (
                    <Upload className="text-muted-foreground h-4 w-4" />
                  )}
                  <span className={cn(file ? "text-foreground" : "text-muted-foreground")}>
                    {file
                      ? `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
                      : "Choose PDF (max 100 MB, 1000 pages)"}
                  </span>
                </span>
                {file && <span className="text-primary text-xs">Change</span>}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ai-count">Number of questions</Label>
                <Input
                  id="ai-count"
                  type="number"
                  min={5}
                  max={50}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value || "0", 10))}
                />
                <p className="text-muted-foreground text-xs">5–50</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-language">Language</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "hi")}>
                  <SelectTrigger id="ai-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Question types</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_TYPES.map((t) => {
                  const active = types.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => toggleType(t.value)}
                      className={cn(
                        "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Difficulty mix (must sum to 100)</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Easy</p>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={easy}
                    onChange={(e) => setEasy(parseInt(e.target.value || "0", 10))}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Medium</p>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={medium}
                    onChange={(e) => setMedium(parseInt(e.target.value || "0", 10))}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Hard</p>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={hard}
                    onChange={(e) => setHard(parseInt(e.target.value || "0", 10))}
                  />
                </div>
              </div>
              <p
                className={cn(
                  "text-xs",
                  mixValid ? "text-muted-foreground" : "text-destructive"
                )}
              >
                Sum: {mixSum}%
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ai-subject">Subject (optional)</Label>
                <Input
                  id="ai-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Physics"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ai-chapter">Chapter (optional)</Label>
                <Input
                  id="ai-chapter"
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                  placeholder="Mechanics"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ai-topic">Topic (optional)</Label>
                <Input
                  id="ai-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Newton's laws"
                />
              </div>
            </div>
          </div>
        ) : (
          // ---- Job in progress / completed view ----
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {jobStatus?.state === "completed" ? (
                <CheckCircle2 className="text-green-600 h-6 w-6 shrink-0" />
              ) : jobStatus?.state === "failed" ? (
                <XCircle className="text-destructive h-6 w-6 shrink-0" />
              ) : (
                <Loader2 className="text-primary h-6 w-6 shrink-0 animate-spin" />
              )}
              <div className="flex-1">
                <p className="text-foreground text-sm font-medium">
                  {progressLabel}
                </p>
                {jobStatus?.progress?.pageCount !== undefined && (
                  <p className="text-muted-foreground text-xs">
                    PDF: {jobStatus.progress.pageCount} pages
                  </p>
                )}
              </div>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full transition-all",
                  jobStatus?.state === "failed"
                    ? "bg-destructive"
                    : jobStatus?.state === "completed"
                      ? "bg-green-600"
                      : "bg-primary"
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              You can keep this dialog open while it runs. Generated questions
              are saved as <strong>Published</strong> in this question bank and
              are immediately usable in tests.
            </p>
          </div>
        )}

        <DialogFooter>
          {jobId && (jobStatus?.state === "completed" || jobStatus?.state === "failed") ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  reset();
                }}
              >
                Generate more
              </Button>
            </>
          ) : !jobId ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {submit.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Generate
              </Button>
            </>
          ) : (
            <Button variant="outline" disabled={isRunning} onClick={() => onOpenChange(false)}>
              {isRunning ? "Running…" : "Close"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
