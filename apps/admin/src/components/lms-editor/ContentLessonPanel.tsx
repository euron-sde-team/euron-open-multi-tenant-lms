"use client";

import { cn, Button, Input, Label, Switch, useToast } from "@open-mtlms/core";
import {
  ContentLessonView,
  ContentLessonSkeleton,
  CONTENT_FRAME,
  type ContentLessonBody,
} from "@open-mtlms/lms-templates";
import {
  AlignLeft,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type {
  LessonResource,
  LessonResourceType,
} from "@/lib/api/courses-lms";
import {
  useCreateLessonResource,
  useLessonResources,
  useUpdateLessonResource,
} from "@/lib/hooks/use-courses-lms";
import type { ContentLessonType } from "@/lib/types/course-lms";

import { LessonRichEditor } from "./LessonRichEditor";

interface ContentLessonPanelProps {
  /** Resolved LMS course ID (never the page ID from URL params) */
  courseId: string | null;
  /** Persisted lesson ID this content belongs to */
  lessonId: string;
  /** Content lesson type: PDF / LINK / TEXT / IMAGE */
  type: ContentLessonType;
  /**
   * Upload a file to S3 (presigned lecture resource flow) and return the
   * public URL. Required for PDF / IMAGE; reused from the resource flow.
   */
  onUploadFile?: (file: File) => Promise<string | null>;
  /** Render without editing controls (preview mode) */
  readOnly?: boolean;
  className?: string;
}

const TYPE_META: Record<
  ContentLessonType,
  { label: string; icon: React.ElementType }
> = {
  PDF: { label: "PDF Document", icon: FileText },
  LINK: { label: "Embed Link", icon: LinkIcon },
  TEXT: { label: "Text", icon: AlignLeft },
  IMAGE: { label: "Image", icon: ImageIcon },
};

/**
 * Inline editor for a standalone content lesson (PDF / LINK / TEXT / IMAGE).
 * Each content lesson owns exactly ONE lesson_resources row: created on first
 * save, updated thereafter.
 */
export function ContentLessonPanel({
  courseId,
  lessonId,
  type,
  onUploadFile,
  readOnly = false,
  className,
}: ContentLessonPanelProps) {
  const { toast } = useToast();
  const meta = TYPE_META[type];

  const { data: resourcesData, isLoading } = useLessonResources(
    courseId,
    lessonId
  );
  const resource: LessonResource | undefined = resourcesData?.[0];

  const createMut = useCreateLessonResource(courseId ?? "", lessonId);
  const updateMut = useUpdateLessonResource(courseId ?? "", lessonId);

  const showError = (message: string) =>
    toast({ title: "Error", description: message, variant: "destructive" });

  /** Upsert: create on first save, patch thereafter. Returns the resource id. */
  const upsert = async (
    fields: Partial<Pick<LessonResource, "title" | "url" | "content" | "downloadable">>
  ): Promise<void> => {
    if (resource) {
      await updateMut.mutateAsync({ resourceId: resource.id, data: fields });
    } else {
      await createMut.mutateAsync({
        type: type as LessonResourceType,
        title: fields.title ?? meta.label,
        url: fields.url ?? null,
        content: fields.content ?? null,
        downloadable: fields.downloadable ?? false,
        sort_order: 0,
      });
    }
  };

  const isBusy = createMut.isPending || updateMut.isPending;

  const headerLabel = (
    <div className="flex items-center gap-2">
      <div className="rounded bg-muted p-1.5">
        <meta.icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-semibold">{meta.label}</h3>
    </div>
  );

  if (!courseId) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Save the lesson first to add content.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        {headerLabel}
        <ContentLessonSkeleton />
      </div>
    );
  }

  // Preview (read-only) renders the exact student viewer so the admin preview is
  // pixel-identical, same uniform frame, same skeletons, same empty state.
  if (readOnly) {
    const previewBody: ContentLessonBody = {
      type,
      url: resource?.url ?? null,
      content: resource?.content ?? null,
      downloadable: resource?.downloadable ?? false,
      title: resource?.title ?? null,
    };
    return (
      <div className={cn("space-y-4", className)}>
        {headerLabel}
        <ContentLessonView content={previewBody} showMarkComplete={false} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {headerLabel}

      {type === "TEXT" && (
        <TextContentEditor
          resource={resource}
          readOnly={readOnly}
          isBusy={isBusy}
          onUploadFile={onUploadFile}
          onSave={(content) => upsert({ title: meta.label, content })}
          onError={showError}
        />
      )}

      {(type === "PDF" || type === "IMAGE") && (
        <FileContentEditor
          type={type}
          resource={resource}
          readOnly={readOnly}
          isBusy={isBusy}
          onUploadFile={onUploadFile}
          onSave={(url, title) => upsert({ url, title })}
          onToggleDownloadable={(downloadable) =>
            resource &&
            updateMut.mutate(
              { resourceId: resource.id, data: { downloadable } },
              {
                onError: (err) =>
                  showError(
                    err instanceof Error ? err.message : "Failed to update."
                  ),
              }
            )
          }
          onError={showError}
        />
      )}

      {type === "LINK" && (
        <LinkContentEditor
          resource={resource}
          readOnly={readOnly}
          isBusy={isBusy}
          onSave={(url, title) => upsert({ url, title: title || url })}
          onError={showError}
        />
      )}
    </div>
  );
}

// ── TEXT ──

function TextContentEditor({
  resource,
  readOnly,
  isBusy,
  onUploadFile,
  onSave,
  onError,
}: {
  resource?: LessonResource;
  readOnly: boolean;
  isBusy: boolean;
  onUploadFile?: (file: File) => Promise<string | null>;
  onSave: (content: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [content, setContent] = useState(resource?.content ?? "");
  const [isDirty, setIsDirty] = useState(false);

  // Sync from server once the resource loads (only when not actively editing).
  useEffect(() => {
    if (!isDirty) setContent(resource?.content ?? "");
  }, [resource?.id, resource?.content, isDirty]);

  const handleSave = async () => {
    try {
      await onSave(content);
      setIsDirty(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save content.");
    }
  };

  if (readOnly) {
    return content ? (
      <div
        className="prose prose-sm dark:prose-invert max-w-none rounded-lg bg-muted/50 p-4"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    ) : (
      <p className="text-sm text-muted-foreground italic">No content added yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      <LessonRichEditor
        content={content}
        onChange={(html) => {
          setContent(html);
          setIsDirty(true);
        }}
        onUploadImage={onUploadFile}
        placeholder="Write the lesson content here..."
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={isBusy || !isDirty}>
          {isBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Save Content
        </Button>
        {isDirty && (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}

// ── PDF / IMAGE ──

function FileContentEditor({
  type,
  resource,
  readOnly,
  isBusy,
  onUploadFile,
  onSave,
  onToggleDownloadable,
  onError,
}: {
  type: "PDF" | "IMAGE";
  resource?: LessonResource;
  readOnly: boolean;
  isBusy: boolean;
  onUploadFile?: (file: File) => Promise<string | null>;
  onSave: (url: string, title: string) => Promise<void>;
  onToggleDownloadable: (downloadable: boolean) => void;
  onError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const url = resource?.url ?? null;

  // Reset the load shimmer whenever the previewed file changes.
  useEffect(() => {
    setPreviewLoaded(false);
  }, [url]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadFile) return;
    setUploading(true);
    try {
      const publicUrl = await onUploadFile(file);
      if (!publicUrl) return;
      await onSave(publicUrl, file.name);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Preview, uniform frame matching the student viewer. */}
      {url ? (
        type === "PDF" ? (
          <div
            className={cn(
              CONTENT_FRAME,
              "relative w-full overflow-hidden rounded-lg border bg-muted/30"
            )}
          >
            {!previewLoaded && (
              <div className="absolute inset-0 animate-pulse bg-muted" />
            )}
            <iframe
              src={url}
              title={resource?.title || "PDF preview"}
              onLoad={() => setPreviewLoaded(true)}
              className={cn(
                "relative h-full w-full transition-opacity",
                previewLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        ) : (
          <div
            className={cn(
              CONTENT_FRAME,
              "relative flex w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/20 p-4 sm:p-6"
            )}
          >
            {!previewLoaded && (
              <div className="absolute inset-0 animate-pulse bg-muted" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={resource?.title || "Image preview"}
              onLoad={() => setPreviewLoaded(true)}
              onError={() => setPreviewLoaded(true)}
              className={cn(
                "relative max-h-full w-auto max-w-full rounded-md object-contain transition-opacity",
                previewLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )
      ) : (
        <div
          className={cn(
            CONTENT_FRAME,
            "flex w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground"
          )}
        >
          No {type === "PDF" ? "PDF" : "image"} uploaded yet.
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={type === "PDF" ? "application/pdf,.pdf" : "image/*"}
            className="hidden"
            onChange={handleFileChange}
            aria-hidden
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || isBusy}
            className="gap-1.5"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {url ? "Replace" : "Upload"} {type === "PDF" ? "PDF" : "Image"}
          </Button>

          {resource && (
            <div className="flex items-center gap-1.5">
              <Label
                htmlFor={`downloadable-${resource.id}`}
                className="text-xs text-muted-foreground"
              >
                Downloadable
              </Label>
              <Switch
                id={`downloadable-${resource.id}`}
                checked={resource.downloadable}
                onCheckedChange={onToggleDownloadable}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── LINK ──

function LinkContentEditor({
  resource,
  readOnly,
  isBusy,
  onSave,
  onError,
}: {
  resource?: LessonResource;
  readOnly: boolean;
  isBusy: boolean;
  onSave: (url: string, title: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [url, setUrl] = useState(resource?.url ?? "");
  const [title, setTitle] = useState(resource?.title ?? "");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!isDirty) {
      setUrl(resource?.url ?? "");
      setTitle(resource?.title ?? "");
    }
  }, [resource?.id, resource?.url, resource?.title, isDirty]);

  const handleSave = async () => {
    if (!url.trim()) return;
    try {
      await onSave(url.trim(), title.trim());
      setIsDirty(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save link.");
    }
  };

  if (readOnly) {
    return url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {title || url}
      </a>
    ) : (
      <p className="text-sm text-muted-foreground italic">No link added yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Title (optional)</Label>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setIsDirty(true);
          }}
          placeholder="Link title"
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">URL</Label>
        <Input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setIsDirty(true);
          }}
          placeholder="https://example.com"
          type="url"
          className="h-9"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isBusy || !url.trim() || !isDirty}
        >
          {isBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Save Link
        </Button>
        {url.trim() && (
          <Button variant="outline" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

export default ContentLessonPanel;
