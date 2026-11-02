"use client";

/**
 * Batch thumbnail picker, two slots (web + mobile) matching the course
 * thumbnail UX. Uploads via `uploadApi.uploadBatchThumbnail`. The picker is
 * "save on close": each slot uploads independently the moment a file is
 * chosen, and `onChange` is called with whichever keys are now set.
 *
 * The shared `ThumbnailPickerModal` in `course-editor/modals/` directly
 * imports `useCourseAIGeneration` and `uploadCourseThumbnail`, so we ship a
 * standalone picker here instead of trying to wedge a batch-id through a
 * course-coupled component. AI thumbnail generation lands in Phase 11 via a
 * separate `BatchAIGenerateModal` that writes back through the same
 * `onChange` shape.
 */

import {
  Button,
  Card,
  CardContent,
  Label,
  useToast,
} from "@open-mtlms/core";
import { ImagePlus, Loader2, Monitor, Smartphone, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { uploadApi } from "@/lib/api/upload";

const FOCUS_FIX =
  "focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-primary " +
  "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary";

export interface BatchThumbnailValue {
  webKey: string | null;
  webUrl: string | null;
  mobileKey: string | null;
  mobileUrl: string | null;
}

interface Props {
  tenantId: string;
  /** Pass null while the batch is being created and there's no id yet, the
   *  upload helper will land the file under a per-tenant fallback path. */
  batchId: string | null;
  value: BatchThumbnailValue;
  onChange: (next: BatchThumbnailValue) => void;
}

export function BatchThumbnailPicker({
  tenantId,
  batchId,
  value,
  onChange,
}: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Slot
        label="Web thumbnail"
        helper="Shown on desktop. Aim for 16:9, at least 1280×720."
        icon={<Monitor className="h-4 w-4" />}
        slot="web"
        currentKey={value.webKey}
        currentUrl={value.webUrl}
        tenantId={tenantId}
        batchId={batchId}
        onUploaded={(key, url) =>
          onChange({ ...value, webKey: key, webUrl: url })
        }
        onClear={() =>
          onChange({ ...value, webKey: null, webUrl: null })
        }
      />
      <Slot
        label="Mobile thumbnail"
        helper="Shown on phones. Aim for 4:5 or 3:4 portrait."
        icon={<Smartphone className="h-4 w-4" />}
        slot="mobile"
        currentKey={value.mobileKey}
        currentUrl={value.mobileUrl}
        tenantId={tenantId}
        batchId={batchId}
        onUploaded={(key, url) =>
          onChange({ ...value, mobileKey: key, mobileUrl: url })
        }
        onClear={() =>
          onChange({ ...value, mobileKey: null, mobileUrl: null })
        }
      />
    </div>
  );
}

interface SlotProps {
  label: string;
  helper: string;
  icon: React.ReactNode;
  slot: "web" | "mobile";
  currentKey: string | null;
  currentUrl: string | null;
  tenantId: string;
  batchId: string | null;
  onUploaded: (key: string, url: string) => void;
  onClear: () => void;
}

function Slot({
  label,
  helper,
  icon,
  slot,
  currentKey,
  currentUrl,
  tenantId,
  batchId,
  onUploaded,
  onClear,
}: SlotProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please choose an image.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum image size is 10MB.",
        variant: "destructive",
      });
      return;
    }
    setIsUploading(true);
    try {
      const result = await uploadApi.uploadBatchThumbnail(file, {
        type: "batch_thumbnail",
        tenantId,
        batchId,
        slot,
      });
      onUploaded(result.key, result.url);
      toast({ title: "Uploaded", description: `${label} saved.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // Fixed-size preview chip, never stretches to fill the card. 16:9 for web,
  // 3:4 portrait for mobile. The web preview is ~160×90, mobile is ~96×128.
  const previewSizeClass =
    slot === "web" ? "h-[90px] w-[160px]" : "h-[128px] w-[96px]";

  return (
    <Card>
      <CardContent className="p-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <Label className="text-sm font-medium">{label}</Label>
        </div>
        <p className="text-muted-foreground mb-3 text-xs">{helper}</p>
        <div className="flex items-center gap-3">
          <div
            className={`bg-muted relative flex-shrink-0 overflow-hidden rounded-md ${previewSizeClass}`}
          >
            {currentUrl ? (
              <img
                src={currentUrl}
                alt={label}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-[10px]">
                No image
              </div>
            )}
            {isUploading && (
              <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
                <Loader2 className="text-primary h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div className="flex flex-col items-start gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={FOCUS_FIX}
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-3.5 w-3.5" />
              {currentKey ? "Replace" : "Upload"}
            </Button>
            {currentKey && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`text-destructive ${FOCUS_FIX}`}
                disabled={isUploading}
                onClick={onClear}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
