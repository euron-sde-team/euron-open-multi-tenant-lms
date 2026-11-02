"use client";

/**
 * Batch AI generation modal, single dialog that drives both segment-wise
 * generation and "generate all". Mirrors the course/book AI modals: sections
 * are toggleable, extra-context textarea is optional, progress view shows
 * per-section status, and a single "Apply" button writes the generated
 * fields back to the batch.
 *
 * Apply pipeline:
 *   1. Text fields (subtitle / description / learningOutcomes) →
 *      `batchesApi.updateBatch()`
 *   2. Thumbnail data URLs → `uploadApi.uploadBatchThumbnailBase64()` →
 *      `batchesApi.updateBatch({ web_thumbnail_key, mobile_thumbnail_key })`
 *
 * Failure of one section never blocks the others: applying is fine-grained,
 * the modal disables Apply only when nothing succeeded.
 */

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  useToast,
} from "@open-mtlms/core";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  ALL_BATCH_AI_SECTION_KEYS,
  type BatchAISectionKey,
  type BatchThumbnailContext,
  type GeneratedBatchContent,
} from "@/lib/api/batch-ai";
import { batchesApi, type BatchDetail } from "@/lib/api/batches";
import { uploadApi } from "@/lib/api/upload";
import { useBatchAIGeneration } from "@/lib/hooks/useBatchAIGeneration";

const FOCUS_FIX =
  "focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-primary " +
  "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary";

interface SectionMeta {
  key: BatchAISectionKey;
  label: string;
  helper: string;
}

const SECTIONS: SectionMeta[] = [
  {
    key: "subtitle",
    label: "Subtitle",
    helper: "Single sentence under the title",
  },
  {
    key: "description",
    label: "Description",
    helper: "2–3 paragraph marketing copy",
  },
  {
    key: "learningOutcomes",
    label: "What learners will gain",
    helper: "5–6 outcome bullet points",
  },
  {
    key: "webThumbnail",
    label: "Web thumbnail",
    helper: "16:9 image for desktop",
  },
  {
    key: "mobileThumbnail",
    label: "Mobile thumbnail",
    helper: "Portrait image for phones",
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: BatchDetail;
  tenantId: string;
  /** Optional pre-selection, opens the modal with just this section ticked.
   *  Pass `null` (default) to start with all sections selected. */
  initialSection?: BatchAISectionKey | null;
  /** Optional org metadata to give the thumbnail prompt a richer brief. */
  thumbnailContext?: BatchThumbnailContext;
  /** Called after a successful Apply so the parent can re-fetch the batch. */
  onApplied: () => void;
}

export function BatchAIGenerateModal({
  open,
  onOpenChange,
  batch,
  tenantId,
  initialSection,
  thumbnailContext,
  onApplied,
}: Props) {
  const { toast } = useToast();
  const ai = useBatchAIGeneration();

  const [selected, setSelected] = useState<Set<BatchAISectionKey>>(
    () =>
      new Set(
        initialSection
          ? [initialSection]
          : ALL_BATCH_AI_SECTION_KEYS
      )
  );
  const [extraContext, setExtraContext] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      ai.reset();
      setSelected(
        new Set(initialSection ? [initialSection] : ALL_BATCH_AI_SECTION_KEYS)
      );
      setExtraContext("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSection]);

  const toggle = (key: BatchAISectionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sections = useMemo(() => Array.from(selected), [selected]);

  const handleSubmit = () => {
    if (sections.length === 0) {
      toast({
        title: "Pick at least one section",
        description: "Tick the fields you want generated.",
        variant: "destructive",
      });
      return;
    }
    void ai.submit({
      batchId: batch.id,
      batchTitle: batch.title,
      sections,
      extraContext: extraContext.trim() || undefined,
      thumbnailContext,
    });
  };

  /** Take whatever the AI has produced and write it back to the batch. */
  const handleApply = async () => {
    const r = ai.result;
    if (!r) return;
    setIsApplying(true);
    try {
      // Step 1, upload base64 thumbnails to S3 if present.
      let webKey: string | undefined;
      let mobileKey: string | undefined;
      if (r.webThumbnailDataUrl) {
        const uploaded = await uploadApi.uploadBatchThumbnailBase64(
          r.webThumbnailDataUrl,
          {
            type: "batch_thumbnail",
            tenantId,
            batchId: batch.id,
            slot: "web",
          }
        );
        webKey = uploaded.key;
      }
      if (r.mobileThumbnailDataUrl) {
        const uploaded = await uploadApi.uploadBatchThumbnailBase64(
          r.mobileThumbnailDataUrl,
          {
            type: "batch_thumbnail",
            tenantId,
            batchId: batch.id,
            slot: "mobile",
          }
        );
        mobileKey = uploaded.key;
      }

      // Step 2, write all fields in one update call. We only include keys
      // that AI actually produced; everything else stays at its previous value.
      await batchesApi.updateBatch(batch.id, {
        ...(r.subtitle !== undefined ? { subtitle: r.subtitle } : {}),
        ...(r.description !== undefined ? { description: r.description } : {}),
        ...(r.learningOutcomes !== undefined
          ? { learning_outcomes: r.learningOutcomes }
          : {}),
        ...(webKey ? { web_thumbnail_key: webKey } : {}),
        ...(mobileKey ? { mobile_thumbnail_key: mobileKey } : {}),
      });

      toast({
        title: "Applied",
        description: "AI suggestions have been saved to the batch.",
      });
      onApplied();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Apply failed";
      toast({ title: "Apply failed", description: msg, variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  const inProgress = ai.isActive;
  const hasResult =
    !!ai.result && Object.keys(ai.result).length > 0;
  const showProgress = inProgress || ai.state === "completed" || ai.state === "failed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="text-primary h-4 w-4" />
            Generate with AI
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pick the parts you want generated and we&apos;ll draft them based
            on the batch title. You can review the results before applying.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!showProgress && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">What to generate</Label>
                <div className="mt-2 grid gap-2">
                  {SECTIONS.map((s) => {
                    const isOn = selected.has(s.key);
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => toggle(s.key)}
                        className={`hover:bg-muted/40 flex w-full cursor-pointer items-start gap-3 rounded-md border p-2.5 text-left text-sm ${FOCUS_FIX} ${
                          isOn ? "border-primary bg-primary/5" : ""
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                            isOn
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isOn && <Check className="h-3 w-3" />}
                        </div>
                        <div>
                          <div className="font-medium">{s.label}</div>
                          <div className="text-muted-foreground text-xs">
                            {s.helper}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="batch-ai-context" className="text-sm">
                  Extra instructions{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <textarea
                  id="batch-ai-context"
                  className={`border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm ${FOCUS_FIX}`}
                  placeholder="E.g., target audience, tone, must-cover topics, constraints…"
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
                />
              </div>
            </div>
          )}

          {showProgress && (
            <div className="space-y-3">
              <ProgressBar progress={ai.progress} />
              <ul className="space-y-2">
                {SECTIONS.filter((s) => sections.includes(s.key)).map((s) => {
                  const sp = ai.progress?.sections?.[s.key];
                  return (
                    <li
                      key={s.key}
                      className="bg-muted/40 flex items-start gap-3 rounded-md p-2.5 text-sm"
                    >
                      <StatusIcon status={sp?.status} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{s.label}</div>
                        {sp?.status === "failed" && sp.error && (
                          <div className="text-destructive mt-0.5 line-clamp-2 text-xs">
                            {sp.error}
                          </div>
                        )}
                        {sp?.status === "completed" && (
                          <ResultPreview
                            sectionKey={s.key}
                            result={ai.result ?? {}}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {ai.error && ai.state === "failed" && (
                <p className="text-destructive text-sm">{ai.error}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-3">
          {!showProgress && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={inProgress}>
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Generate
              </Button>
            </>
          )}
          {showProgress && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isApplying}
              >
                Close
              </Button>
              <Button
                variant="ghost"
                onClick={() => ai.reset()}
                disabled={inProgress || isApplying}
              >
                Start over
              </Button>
              <Button
                onClick={handleApply}
                disabled={inProgress || !hasResult || isApplying}
              >
                {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply to batch
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProgressBar({ progress }: { progress: { completedCount: number; totalCount: number } | null }) {
  const pct = progress && progress.totalCount > 0
    ? Math.round((progress.completedCount / progress.totalCount) * 100)
    : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium">
          {progress?.completedCount ?? 0} / {progress?.totalCount ?? 0}
        </span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string | undefined }) {
  if (status === "completed") {
    return <CheckCircle2 className="text-emerald-500 h-4 w-4 flex-shrink-0" />;
  }
  if (status === "failed") {
    return <AlertCircle className="text-destructive h-4 w-4 flex-shrink-0" />;
  }
  if (status === "processing") {
    return <Loader2 className="text-primary h-4 w-4 flex-shrink-0 animate-spin" />;
  }
  return (
    <div className="border-muted-foreground/30 h-4 w-4 flex-shrink-0 rounded-full border-2" />
  );
}

function ResultPreview({
  sectionKey,
  result,
}: {
  sectionKey: BatchAISectionKey;
  result: Partial<GeneratedBatchContent>;
}) {
  if (sectionKey === "subtitle" && result.subtitle) {
    return (
      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
        {result.subtitle}
      </p>
    );
  }
  if (sectionKey === "description" && result.description) {
    return (
      <p className="text-muted-foreground mt-1 line-clamp-3 text-xs">
        {result.description}
      </p>
    );
  }
  if (sectionKey === "learningOutcomes" && result.learningOutcomes?.length) {
    return (
      <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-4 text-xs">
        {result.learningOutcomes.slice(0, 3).map((o, i) => (
          <li key={i} className="line-clamp-1">
            {o}
          </li>
        ))}
        {result.learningOutcomes.length > 3 && (
          <li>+{result.learningOutcomes.length - 3} more</li>
        )}
      </ul>
    );
  }
  if (sectionKey === "webThumbnail" && result.webThumbnailDataUrl) {
    return (
      <img
        src={result.webThumbnailDataUrl}
        alt="Web preview"
        className="mt-1 aspect-video w-32 rounded object-cover"
      />
    );
  }
  if (sectionKey === "mobileThumbnail" && result.mobileThumbnailDataUrl) {
    return (
      <img
        src={result.mobileThumbnailDataUrl}
        alt="Mobile preview"
        className="mt-1 aspect-[3/4] w-20 rounded object-cover"
      />
    );
  }
  return null;
}
