"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Loader2,
  Check,
  Image as ImageIcon,
  AlignLeft,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { RichTextContent } from "../Resources/RichTextContent";
import { CONTENT_FRAME } from "./ContentLessonSkeleton";

/**
 * Content body for a standalone content lesson (PDF/LINK/TEXT/IMAGE). Mirrors
 * the `content` field added to LMSLesson in @open-mtlms/shared.
 */
export interface ContentLessonBody {
  type: "PDF" | "LINK" | "TEXT" | "IMAGE";
  url?: string | null;
  content?: string | null;
  downloadable?: boolean;
  title?: string | null;
}

interface ContentLessonViewProps {
  /** The content body to render */
  content: ContentLessonBody;
  /** Lesson title (fallback for content.title) */
  lessonTitle?: string;
  /** Whether the current lesson is already marked complete */
  isCompleted?: boolean;
  /** Whether there is a next lesson to advance to */
  hasNext?: boolean;
  /**
   * Marks the lesson complete. Content lessons have no auto-complete trigger
   * (no video 90%, no submit) so this is the only way to complete them, shown
   * EVEN in sequential mode to unlock the next lesson.
   */
  onMarkComplete?: () => Promise<void> | void;
  /** Whether to show the mark-complete CTA (gated by progress tracking) */
  showMarkComplete?: boolean;
  className?: string;
}

/** Tailwind classes applied to sanitized rich text content (mirrors ResourceItem). */
const TEXT_CONTENT_CLASSES = cn(
  "text-[15px] leading-relaxed text-foreground/90 break-words",
  "[&_p]:my-2 [&_a]:text-primary [&_a]:underline",
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
  "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2",
  "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2",
  "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:pr-16",
  "[&_code]:text-[13px] [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic",
  "[&_img]:max-w-full [&_img]:rounded-md"
);

/** Try to derive a readable host label from a URL for the link card. */
function getLinkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Per-type "coming soon" copy, shown when a content lesson has no body yet. */
const COMING_SOON: Record<
  ContentLessonBody["type"],
  { icon: React.ElementType; title: string; line: string }
> = {
  PDF: {
    icon: FileText,
    title: "PDF coming soon",
    line: "This lesson's document isn't available yet. Check back later.",
  },
  IMAGE: {
    icon: ImageIcon,
    title: "Image coming soon",
    line: "This lesson's image isn't available yet. Check back later.",
  },
  LINK: {
    icon: LinkIcon,
    title: "Link coming soon",
    line: "This lesson's resource isn't available yet. Check back later.",
  },
  TEXT: {
    icon: AlignLeft,
    title: "Content coming soon",
    line: "This lesson's content isn't available yet. Check back later.",
  },
};

/** Type-aware empty state, replaces the generic video "coming soon" message. */
function ComingSoon({ type }: { type: ContentLessonBody["type"] }) {
  const { icon: Icon, title, line } = COMING_SOON[type];
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card p-10 text-center sm:p-14">
      <div className="rounded-full bg-muted p-4 text-muted-foreground">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{line}</p>
    </div>
  );
}

/** Whether a content body has anything to render (TEXT looks at content, others at url). */
function hasContentBody(content: ContentLessonBody): boolean {
  if (content.type === "TEXT") {
    return (content.content ?? "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim().length > 0;
  }
  return !!content.url;
}

/**
 * Renders a standalone content lesson (PDF/LINK/TEXT/IMAGE) inline in the main
 * lesson area, the same slot the video player / quiz / assignment occupies.
 *
 * Completion: content lessons have no auto-complete trigger, so a "Mark as
 * complete & continue" button is always offered (even in sequential mode) to
 * unlock the next lesson.
 */
export function ContentLessonView({
  content,
  lessonTitle,
  isCompleted = false,
  hasNext = true,
  onMarkComplete,
  showMarkComplete = true,
  className,
}: ContentLessonViewProps) {
  const [marking, setMarking] = useState(false);
  const title = content.title || lessonTitle || "";

  const handleDownload = useCallback(async () => {
    if (!content.url || !content.downloadable) return;
    try {
      const response = await fetch(content.url);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = title || "download";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch {
      window.open(content.url, "_blank", "noopener,noreferrer");
    }
  }, [content.url, content.downloadable, title]);

  const handleMarkComplete = useCallback(async () => {
    if (marking || isCompleted) return;
    setMarking(true);
    try {
      await onMarkComplete?.();
    } finally {
      setMarking(false);
    }
  }, [marking, isCompleted, onMarkComplete]);

  const isEmpty = !hasContentBody(content);

  // Media (PDF/IMAGE) load shimmer, reset whenever the source changes. The
  // <object> load event is unreliable, so a fallback timer reveals the frame.
  const [mediaLoaded, setMediaLoaded] = useState(false);
  useEffect(() => {
    setMediaLoaded(false);
    if (content.type !== "PDF" && content.type !== "IMAGE") return;
    const t = setTimeout(() => setMediaLoaded(true), 2500);
    return () => clearTimeout(t);
  }, [content.url, content.type]);

  // Uniform, responsive frame shared with the admin preview + loading skeleton:
  // one fixed-height box (scaling phone → desktop) with internal scroll, so all
  // four content types are identically sized at every breakpoint.
  const frame = cn(
    CONTENT_FRAME,
    "relative w-full overflow-auto rounded-lg border"
  );

  return (
    <div className={cn("w-full", className)}>
      {/* ── Body (uniform fixed-size frame, identical on admin + student) ── */}
      {isEmpty ? (
        <div className={cn(frame, "flex items-center justify-center bg-card")}>
          <ComingSoon type={content.type} />
        </div>
      ) : content.type === "TEXT" ? (
        <div className={cn(frame, "bg-card")}>
          <div className="p-4 sm:p-6 lg:p-8">
            <RichTextContent
              html={content.content ?? ""}
              className={TEXT_CONTENT_CLASSES}
            />
          </div>
        </div>
      ) : content.type === "IMAGE" ? (
        <div
          className={cn(
            frame,
            "flex items-center justify-center overflow-hidden bg-card p-4 sm:p-6"
          )}
        >
          {!mediaLoaded && (
            <div className="absolute inset-0 animate-pulse bg-muted" />
          )}
          {content.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={content.url}
              alt={title || "Lesson image"}
              onLoad={() => setMediaLoaded(true)}
              onError={() => setMediaLoaded(true)}
              className={cn(
                "relative mx-auto max-h-full w-auto max-w-full rounded-md object-contain transition-opacity",
                mediaLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          )}
        </div>
      ) : content.type === "PDF" ? (
        <div className={cn(frame, "overflow-hidden bg-muted/20")}>
          {!mediaLoaded && (
            <div className="absolute inset-0 animate-pulse bg-muted" />
          )}
          {content.url ? (
            // Inline PDF viewer. #toolbar=0 hides the browser's built-in
            // download/print affordance so we control downloadability.
            <object
              data={`${content.url}#toolbar=${content.downloadable ? "1" : "0"}&navpanes=0`}
              type="application/pdf"
              onLoad={() => setMediaLoaded(true)}
              className={cn(
                "relative h-full w-full transition-opacity",
                mediaLoaded ? "opacity-100" : "opacity-0"
              )}
              aria-label={title || "PDF document"}
            >
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                Inline PDF preview is not supported in this browser.
              </div>
            </object>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
              <FileText className="mr-2 h-5 w-5" />
              No document attached.
            </div>
          )}
        </div>
      ) : (
        // LINK
        <div
          className={cn(
            frame,
            "flex items-center justify-center bg-card p-6 sm:p-8"
          )}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-950/50">
              <LinkIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground">
                {title || "External resource"}
              </h3>
              {content.url && (
                <p className="mt-1 max-w-full truncate text-sm text-muted-foreground">
                  {getLinkLabel(content.url)}
                </p>
              )}
            </div>
            {content.url && (
              <a
                href={content.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ExternalLink className="h-4 w-4" />
                Open link
              </a>
            )}
          </div>
        </div>
      )}

      {/* Download (IMAGE/PDF) sits below the frame for a clean, consistent layout. */}
      {(content.type === "IMAGE" || content.type === "PDF") &&
        content.downloadable &&
        content.url &&
        !isEmpty && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Download{content.type === "PDF" ? " PDF" : ""}
            </button>
          </div>
        )}

      {/* ── Mark complete & continue ──
          Content lessons have no auto-complete trigger, so this button is the
          only completion path, shown even in sequential mode. */}
      {showMarkComplete && onMarkComplete && (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleMarkComplete}
            disabled={marking || isCompleted}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
              isCompleted
                ? "border border-green-500/40 bg-green-50 text-green-600 dark:bg-green-950/30"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
              "disabled:cursor-not-allowed disabled:opacity-70"
            )}
          >
            {marking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isCompleted ? (
              <Check className="h-4 w-4" />
            ) : null}
            {isCompleted
              ? "Completed"
              : hasNext
                ? "Mark as complete & continue"
                : "Mark as complete"}
          </button>
        </div>
      )}
    </div>
  );
}

export default ContentLessonView;
