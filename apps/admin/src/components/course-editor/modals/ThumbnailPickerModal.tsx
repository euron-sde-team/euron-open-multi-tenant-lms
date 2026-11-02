"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  useToast,
} from "@open-mtlms/core";
import { Upload, X, Monitor, Smartphone, Video, Sparkles, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState, useRef, useEffect, useCallback } from "react";

import { type CourseMetadata, type ThumbnailContext } from "@/lib/api/course-ai";
import { uploadApi } from "@/lib/api/upload";
import { useCourseAIGeneration } from "@/lib/hooks/useCourseAIGeneration";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

export type ThumbnailTarget = "web" | "mobile";

export interface ThumbnailSelectPayload {
  thumbnailKey?: string | null;
  secondaryThumbnailKey?: string | null;
  previewKey?: string | null;
  thumbnailUrl: string;
  secondaryThumbnailUrl: string;
  previewUrl?: string;
}

interface ThumbnailPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (payload: ThumbnailSelectPayload) => void;
  tenantId: string;
  courseId: string | null;
  currentWebImage?: string;
  currentMobileImage?: string;
  currentPreviewUrl?: string;
  courseTitle?: string;
  thumbnailContext?: ThumbnailContext;
  courseMetadata?: CourseMetadata;
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please select an image file"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error("Image size must be less than 10MB"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? "");
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function SingleThumbnailSection({
  label,
  icon: Icon,
  selectedSrc,
  setSelectedSrc,
  selectedKey: _selectedKey,
  setSelectedKey,
  onFileUpload,
  error,
  setError,
  fileInputRef,
  onGenerateWithAI,
  isGeneratingAI,
}: {
  label: string;
  icon: React.ElementType;
  selectedSrc: string | null;
  setSelectedSrc: (v: string | null) => void;
  selectedKey: string | null;
  setSelectedKey: (v: string | null) => void;
  onFileUpload?: (file: File) => Promise<{ key: string; url: string }>;
  error: string | null;
  setError: (v: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onGenerateWithAI?: () => void;
  isGeneratingAI?: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImageLoadError(false);
    if (onFileUpload) {
      setIsUploading(true);
      try {
        const result = await onFileUpload(file);
        if (result?.url && result?.key) {
          setSelectedKey(result.key);
          setSelectedSrc(result.url);
        } else {
          setError("Upload succeeded but no URL returned");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSelectedSrc(dataUrl);
      setSelectedKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid file");
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: "var(--preview-border, hsl(var(--border)))" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        {onGenerateWithAI && (
          <button
            type="button"
            onClick={onGenerateWithAI}
            disabled={isGeneratingAI}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted/50 transition-colors border disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: "hsl(var(--border))" }}
            title="Generate with AI"
          >
            {isGeneratingAI ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "hsl(var(--primary))" }} />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" style={{ color: "hsl(var(--primary))" }} />
                AI
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />
      {isUploading ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg min-h-[140px] py-4 px-3 border-muted-foreground/25 bg-muted/30">
          <p className="text-sm font-medium">Uploading…</p>
        </div>
      ) : selectedSrc ? (
        <div className="space-y-2">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
            {!imageLoadError ? (
              <Image
                src={selectedSrc}
                alt={label}
                fill
                className="object-contain"
                unoptimized
                onError={() => setImageLoadError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center text-sm text-muted-foreground">
                <span>Preview unavailable</span>
                <span className="text-xs">Image uploaded successfully</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedSrc(null);
                setSelectedKey(null);
                setImageLoadError(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-3.5 w-3.5" />
            Change image
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && !isUploading && fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors min-h-[140px] py-4 px-3 border-muted-foreground/25"
        >
          <Upload className="h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm font-medium mb-0.5">Click to upload</p>
          <p className="text-xs text-muted-foreground">PNG, JPG, GIF, WebP up to 10MB</p>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ThumbnailPickerModal({
  open,
  onOpenChange,
  onSelect,
  tenantId,
  courseId,
  currentWebImage = "",
  currentMobileImage = "",
  currentPreviewUrl = "",
  courseTitle = "",
  thumbnailContext,
  courseMetadata,
}: ThumbnailPickerModalProps) {
  const { toast } = useToast();
  const [webSrc, setWebSrc] = useState<string | null>(currentWebImage || null);
  const [mobileSrc, setMobileSrc] = useState<string | null>(currentMobileImage || null);
  const [webKey, setWebKey] = useState<string | null>(null);
  const [mobileKey, setMobileKey] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [webError, setWebError] = useState<string | null>(null);
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState(currentPreviewUrl);
  const [isConfirming, setIsConfirming] = useState(false);
  const webFileRef = useRef<HTMLInputElement>(null);
  const mobileFileRef = useRef<HTMLInputElement>(null);

  const thumbnailAI = useCourseAIGeneration();
  const isGeneratingThumbnails = thumbnailAI.isActive;
  const aiAuthoringEnabled = useAiAuthoringEnabled();

  useEffect(() => {
    if (open) {
      setWebSrc(currentWebImage || null);
      setMobileSrc(currentMobileImage || null);
      setWebKey(null);
      setMobileKey(null);
      setPreviewKey(null);
      setWebError(null);
      setMobileError(null);
      setPreviewUrl(currentPreviewUrl);
      thumbnailAI.reset();
      setIsConfirming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentWebImage, currentMobileImage, currentPreviewUrl]);

  const handleGenerateThumbnails = useCallback(async () => {
    if (thumbnailAI.isActive) return;

    if (!courseTitle.trim()) {
      toast({
        title: "Course title required",
        description: "Please set a course title before generating thumbnails",
        variant: "destructive",
      });
      return;
    }

    setWebError(null);
    setMobileError(null);
    await thumbnailAI.submit({
      courseTitle: courseTitle.trim(),
      sections: ["thumbnails"],
      thumbnailContext,
      courseMetadata,
    });
  }, [thumbnailAI, courseTitle, thumbnailContext, courseMetadata, toast]);

  // Handle AI generation completion
  useEffect(() => {
    if (thumbnailAI.state === "completed" && thumbnailAI.result) {
      if (thumbnailAI.result.webThumbnailDataUrl) {
        setWebSrc(thumbnailAI.result.webThumbnailDataUrl);
        setWebKey(null);
      }
      if (thumbnailAI.result.mobileThumbnailDataUrl) {
        setMobileSrc(thumbnailAI.result.mobileThumbnailDataUrl);
        setMobileKey(null);
      }
      if (!thumbnailAI.result.webThumbnailDataUrl && !thumbnailAI.result.mobileThumbnailDataUrl) {
        setWebError("No thumbnails were generated");
        setMobileError("No thumbnails were generated");
      } else {
        toast({
          title: "Success",
          description: "Thumbnails generated successfully!",
        });
      }
    } else if (thumbnailAI.state === "failed") {
      const errorMsg = thumbnailAI.error ?? "Failed to generate thumbnails";
      setWebError(errorMsg);
      setMobileError(errorMsg);
      toast({
        title: "Generation failed",
        description: errorMsg,
        variant: "destructive",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbnailAI.state]);

  const canConfirm = Boolean(webSrc && mobileSrc) && !isConfirming && !isGeneratingThumbnails;

  const handleConfirm = async () => {
    if (!webSrc || !mobileSrc) return;

    setIsConfirming(true);
    let finalWebKey = webKey;
    let finalWebSrc = webSrc;
    let finalMobileKey = mobileKey;
    let finalMobileSrc = mobileSrc;

    try {
      if (webSrc.startsWith("data:") && tenantId && courseId) {
        const file = dataUrlToFile(webSrc, "thumbnail-web.jpg");
        const result = await uploadApi.uploadCourseThumbnail(file, { type: "course_thumbnail", tenantId, courseId, slot: "web" });
        finalWebKey = result.key;
        finalWebSrc = result.url;
      }

      if (mobileSrc.startsWith("data:") && tenantId && courseId) {
        const file = dataUrlToFile(mobileSrc, "thumbnail-mobile.jpg");
        const result = await uploadApi.uploadCourseThumbnail(file, { type: "course_thumbnail", tenantId, courseId, slot: "mobile" });
        finalMobileKey = result.key;
        finalMobileSrc = result.url;
      }
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Failed to upload AI thumbnail",
        variant: "destructive",
      });
      setIsConfirming(false);
      return;
    }

    onSelect({
      thumbnailKey: finalWebKey ?? undefined,
      secondaryThumbnailKey: finalMobileKey ?? undefined,
      previewKey: previewKey ?? undefined,
      thumbnailUrl: finalWebSrc,
      secondaryThumbnailUrl: finalMobileSrc,
      previewUrl: previewUrl.trim() || undefined,
    });
    onOpenChange(false);
    setIsConfirming(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Select course thumbnails</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Upload or generate with AI for both <strong>web</strong> and <strong>mobile</strong> thumbnails. Both are required for the course.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto">
          <SingleThumbnailSection
            label="Web thumbnail"
            icon={Monitor}
            selectedSrc={webSrc}
            setSelectedSrc={setWebSrc}
            selectedKey={webKey}
            setSelectedKey={setWebKey}
            onFileUpload={tenantId && courseId ? (file) => uploadApi.uploadCourseThumbnail(file, { type: "course_thumbnail", tenantId, courseId, slot: "web" }) : undefined}
            error={webError}
            setError={setWebError}
            fileInputRef={webFileRef}
            onGenerateWithAI={courseTitle && aiAuthoringEnabled ? handleGenerateThumbnails : undefined}
            isGeneratingAI={isGeneratingThumbnails}
          />
          <SingleThumbnailSection
            label="Mobile thumbnail"
            icon={Smartphone}
            selectedSrc={mobileSrc}
            setSelectedSrc={setMobileSrc}
            selectedKey={mobileKey}
            setSelectedKey={setMobileKey}
            onFileUpload={tenantId && courseId ? (file) => uploadApi.uploadCourseThumbnail(file, { type: "course_thumbnail", tenantId, courseId, slot: "mobile" }) : undefined}
            error={mobileError}
            setError={setMobileError}
            fileInputRef={mobileFileRef}
            onGenerateWithAI={courseTitle && aiAuthoringEnabled ? handleGenerateThumbnails : undefined}
            isGeneratingAI={isGeneratingThumbnails}
          />
        </div>
        <div className="space-y-2 pt-4 border-t">
          <div className="flex items-center gap-2 font-medium">
            <Video className="h-4 w-4" />
            Preview URL
          </div>
          <p className="text-xs text-muted-foreground">
            Add a YouTube or video link for the course preview (optional).
          </p>
          <Input
            id="preview-url"
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
            placeholder="e.g. https://www.youtube.com/watch?v=..."
            className="h-9"
          />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {isConfirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Select thumbnails"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
