"use client";

import React, { useState } from "react";
import {
  FileText,
  ExternalLink,
  AlignLeft,
  Github,
  Download,
  Eye,
  File,
  Image as ImageIcon,
} from "lucide-react";
import type { LMSResource } from "../../types";
import { cn, formatFileSize } from "../../lib/utils";
import { ResourceViewerDialog } from "./ResourceViewerDialog";
import { RichTextContent } from "./RichTextContent";

interface ResourceItemProps {
  /** Resource data */
  resource: LMSResource;
  /** Called when resource is clicked/viewed */
  onView?: (resource: LMSResource) => void;
  /** Called when download is requested */
  onDownload?: (resource: LMSResource) => void;
  /** Variant style */
  variant?: "default" | "compact" | "card";
  /** Additional class name */
  className?: string;
}

const RESOURCE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  link: ExternalLink,
  article: FileText,
  text: AlignLeft,
  github: Github,
  image: ImageIcon,
};

const RESOURCE_COLORS: Record<string, string> = {
  pdf: "text-red-500 bg-red-50 dark:bg-red-950/50",
  link: "text-blue-500 bg-blue-50 dark:bg-blue-950/50",
  article: "text-purple-500 bg-purple-50 dark:bg-purple-950/50",
  text: "text-gray-500 bg-gray-50 dark:bg-gray-950/50",
  github: "text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800",
  image: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50",
};

/** Tailwind classes applied to sanitized rich text content */
const TEXT_CONTENT_CLASSES = cn(
  "text-sm leading-relaxed text-foreground/90 break-words",
  "[&_p]:my-1.5 [&_a]:text-primary [&_a]:underline",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold",
  "[&_h3]:text-sm [&_h3]:font-semibold",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:pr-16",
  "[&_code]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3",
  "[&_img]:max-w-full [&_img]:rounded-md"
);

export function ResourceItem({
  resource,
  onView,
  onDownload,
  variant = "default",
  className,
}: ResourceItemProps) {
  const [viewerOpen, setViewerOpen] = useState(false);

  const Icon = RESOURCE_ICONS[resource.type] || File;
  const colorClass = RESOURCE_COLORS[resource.type] || RESOURCE_COLORS.text;

  const isPdf = resource.type === "pdf";
  // "image" is a runtime extension not yet part of the ResourceType union
  // (kept in sync with @open-mtlms/shared), compare via string.
  const isImage = (resource.type as string) === "image";
  const isInlineText =
    (resource.type === "text" || resource.type === "article") &&
    !!resource.content;
  /** Non-downloadable PDFs and images open in the inline viewer dialog */
  const opensInDialog = isImage || (isPdf && !resource.downloadable);

  const handleView = () => {
    if (opensInDialog) {
      if (resource.url) setViewerOpen(true);
    } else if (resource.url) {
      window.open(resource.url, "_blank", "noopener,noreferrer");
    }
    onView?.(resource);
  };

  const handleDownload = async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (!resource.downloadable) return;
    if (onDownload) {
      onDownload(resource);
      return;
    }
    if (!resource.url) return;
    // Default download behavior when no handler is provided
    try {
      const response = await fetch(resource.url);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = resource.title || "download";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch {
      window.open(resource.url, "_blank", "noopener,noreferrer");
    }
  };

  const viewerDialog =
    opensInDialog && resource.url ? (
      <ResourceViewerDialog
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        title={resource.title}
      >
        {isImage ? (
          <div className="flex h-full w-full items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resource.url}
              alt={resource.title}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          // Inline PDF viewer, #toolbar=0 hides the browser PDF toolbar
          // (no download/print affordance from us).
          <object
            data={`${resource.url}#toolbar=0&navpanes=0`}
            type="application/pdf"
            className="h-full w-full"
            aria-label={resource.title}
          >
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
              Inline PDF preview is not supported in this browser.
            </div>
          </object>
        )}
      </ResourceViewerDialog>
    ) : null;

  // TEXT / ARTICLE with rich content: render sanitized HTML inline in the list
  if (isInlineText) {
    return (
      <div
        className={cn(
          "space-y-2",
          variant === "card" ? "rounded-lg border bg-card p-4" : "py-2.5 px-2",
          className
        )}
      >
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-md shrink-0", colorClass)}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {resource.title}
          </span>
        </div>
        <RichTextContent
          html={resource.content ?? ""}
          className={TEXT_CONTENT_CLASSES}
        />
      </div>
    );
  }

  // IMAGE: inline preview, click to enlarge; download only when downloadable
  if (isImage) {
    return (
      <>
        <div
          className={cn(
            "space-y-2",
            variant === "card"
              ? "rounded-lg border bg-card p-4"
              : "py-2.5 px-2",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-md shrink-0", colorClass)}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {resource.title}
            </span>
            {resource.downloadable && (
              <button
                type="button"
                onClick={handleDownload}
                className="p-1.5 hover:bg-muted rounded transition-colors shrink-0"
                title="Download"
              >
                <Download className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          {resource.url && (
            <button
              type="button"
              onClick={handleView}
              className="block w-full overflow-hidden rounded-md border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
              title="Click to enlarge"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resource.url}
                alt={resource.title}
                className="max-h-44 w-full cursor-zoom-in object-cover"
                loading="lazy"
              />
            </button>
          )}
        </div>
        {viewerDialog}
      </>
    );
  }

  if (variant === "compact") {
    return (
      <>
        <div
          role="button"
          tabIndex={0}
          onClick={handleView}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleView();
            }
          }}
          className={cn(
            "flex items-center gap-2 w-full p-2 rounded-md cursor-pointer",
            "hover:bg-muted/50 transition-colors text-left",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            className
          )}
        >
          <div className={cn("p-1.5 rounded", colorClass)}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="flex-1 text-sm font-medium truncate">
            {resource.title}
          </span>
          {isPdf && !resource.downloadable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleView();
              }}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="View"
            >
              <Eye className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          {resource.downloadable && (
            <button
              type="button"
              onClick={handleDownload}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Download"
            >
              <Download className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        {viewerDialog}
      </>
    );
  }

  if (variant === "card") {
    return (
      <>
        <div
          className={cn(
            "group relative flex flex-col p-4 rounded-lg border bg-card",
            "hover:shadow-md transition-all cursor-pointer",
            className
          )}
          onClick={handleView}
        >
          <div className="flex items-start gap-3">
            <div className={cn("p-2.5 rounded-lg", colorClass)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm line-clamp-2">
                {resource.title}
              </h4>
              {resource.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {resource.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <span className="text-xs text-muted-foreground capitalize">
              {resource.type}
              {resource.fileSize && ` • ${formatFileSize(resource.fileSize)}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleView();
                }}
                className="p-1.5 hover:bg-muted rounded transition-colors"
                title="View"
              >
                <Eye className="h-4 w-4 text-muted-foreground" />
              </button>
              {resource.downloadable && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-1.5 hover:bg-muted rounded transition-colors"
                  title="Download"
                >
                  <Download className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>
        {viewerDialog}
      </>
    );
  }

  // Default variant
  return (
    <>
      <button
        type="button"
        className={cn(
          "flex items-center gap-3 w-full py-2.5 px-2 rounded-md text-left",
          "hover:bg-muted/50 transition-colors group",
          "focus:outline-none focus:ring-2 focus:ring-primary/30",
          className
        )}
        onClick={handleView}
      >
        <div className={cn("p-1.5 rounded-md shrink-0", colorClass)}>
          <Icon className="h-4 w-4" />
        </div>

        <span className="flex-1 min-w-0 text-sm truncate">
          {resource.title}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {resource.fileSize && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {formatFileSize(resource.fileSize)}
            </span>
          )}
          {resource.type === "link" || resource.type === "github" ? (
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          ) : (
            <>
              {isPdf && !resource.downloadable && (
                <span
                  className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="View"
                >
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              )}
              {resource.downloadable && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleDownload}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleDownload(e);
                    }
                  }}
                  className="p-1.5 hover:bg-muted rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              )}
            </>
          )}
        </div>
      </button>
      {viewerDialog}
    </>
  );
}

export default ResourceItem;
