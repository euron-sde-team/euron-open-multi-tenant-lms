"use client";

import React, { useState } from "react";
import { Download, Check, Loader2, AlertCircle } from "lucide-react";
import type { LMSResource } from "../../types";
import { cn, formatFileSize } from "../../lib/utils";

interface ResourceDownloadProps {
  /** Resource to download */
  resource: LMSResource;
  /** Custom download handler */
  onDownload?: (resource: LMSResource) => Promise<void>;
  /** Variant style */
  variant?: "button" | "icon" | "link";
  /** Additional class name */
  className?: string;
}

type DownloadState = "idle" | "downloading" | "success" | "error";

export function ResourceDownload({
  resource,
  onDownload,
  variant = "button",
  className,
}: ResourceDownloadProps) {
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");

  const handleDownload = async () => {
    if (!resource.downloadable || !resource.url) return;
    
    setDownloadState("downloading");

    try {
      if (onDownload) {
        await onDownload(resource);
      } else {
        // Default download behavior
        const response = await fetch(resource.url);
        if (!response.ok) throw new Error("Download failed");
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = resource.title || "download";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      
      setDownloadState("success");
      setTimeout(() => setDownloadState("idle"), 2000);
    } catch (error) {
      console.error("Download error:", error);
      setDownloadState("error");
      setTimeout(() => setDownloadState("idle"), 3000);
    }
  };

  if (!resource.downloadable) {
    return null;
  }

  const getIcon = () => {
    switch (downloadState) {
      case "downloading":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "success":
        return <Check className="h-4 w-4" />;
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Download className="h-4 w-4" />;
    }
  };

  const getStateClass = () => {
    switch (downloadState) {
      case "success":
        return "text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-950/50";
      case "error":
        return "text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/50";
      default:
        return "";
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleDownload}
        disabled={downloadState === "downloading"}
        className={cn(
          "p-2 rounded-lg transition-colors",
          "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          getStateClass(),
          className
        )}
        title={
          downloadState === "error"
            ? "Download failed. Click to retry."
            : downloadState === "success"
              ? "Downloaded!"
              : "Download"
        }
      >
        {getIcon()}
      </button>
    );
  }

  if (variant === "link") {
    return (
      <button
        onClick={handleDownload}
        disabled={downloadState === "downloading"}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm text-primary hover:underline",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          downloadState === "error" && "text-red-600",
          downloadState === "success" && "text-green-600",
          className
        )}
      >
        {getIcon()}
        <span>
          {downloadState === "downloading"
            ? "Downloading..."
            : downloadState === "success"
              ? "Downloaded!"
              : downloadState === "error"
                ? "Retry download"
                : "Download"}
        </span>
      </button>
    );
  }

  // Button variant (default)
  return (
    <button
      onClick={handleDownload}
      disabled={downloadState === "downloading"}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
        "text-sm font-medium transition-colors",
        "border bg-background hover:bg-muted",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        getStateClass(),
        className
      )}
    >
      {getIcon()}
      <span>
        {downloadState === "downloading"
          ? "Downloading..."
          : downloadState === "success"
            ? "Downloaded!"
            : downloadState === "error"
              ? "Retry"
              : "Download"}
      </span>
      {resource.fileSize && downloadState === "idle" && (
        <span className="text-xs text-muted-foreground">
          ({formatFileSize(resource.fileSize)})
        </span>
      )}
    </button>
  );
}

export default ResourceDownload;
