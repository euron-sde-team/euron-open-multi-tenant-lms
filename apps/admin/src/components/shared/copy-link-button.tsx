"use client";

import { Button, useToast } from "@open-mtlms/core";
import { getErrorMessage } from "@open-mtlms/shared";
import { Check, Link2, Share2 } from "lucide-react";
import { useCallback, useState } from "react";

interface CopyLinkButtonProps {
  /** Fully-qualified public URL to copy (e.g. https://tenant.example.com/courses/python). */
  url: string;
  /** Label used in the toast + tooltip, e.g. "Course". Defaults to a generic "share". */
  label?: string;
  /** Tooltip / aria title. Defaults to `Copy ${label} link`. */
  title?: string;
  /**
   * How to render:
   * - "icon" (default): a compact ghost icon-button to slot into a card's action row.
   * - "full": a full-width labeled "Share Now" button, meant to sit on its own line.
   */
  display?: "icon" | "full";
  /** Icon-button size, match the surrounding action row ("icon" or "sm"). Only used when display="icon". */
  size?: "icon" | "sm";
  className?: string;
}

/**
 * Copies a product's public share link to the clipboard. Two renderings:
 * an inline ghost icon ("icon", default) for action rows, or a full-width
 * "Share Now" button ("full") for its own line under the card actions.
 * Render this ONLY for published products, drafts have no public URL.
 */
export function CopyLinkButton({
  url,
  label,
  title,
  display = "icon",
  size = "icon",
  className,
}: CopyLinkButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const tooltip = title ?? `Copy ${label ? `${label.toLowerCase()} ` : ""}share link`;

  const handleCopy = useCallback(async () => {
    if (!url) {
      toast({
        title: "Link unavailable",
        description: "This tenant has no active domain yet.",
        variant: "destructive",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: `${label ?? "Share"} link copied to clipboard` });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Failed to copy", description: getErrorMessage(err), variant: "destructive" });
    }
  }, [url, label, toast]);

  if (display === "full") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className ?? "w-full gap-2"}
        title={tooltip}
        aria-label={tooltip}
        onClick={handleCopy}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-emerald-600" />
            Copied!
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" />
            Share Now
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className={className ?? (size === "icon" ? "h-8 w-8" : undefined)}
      title={tooltip}
      aria-label={tooltip}
      onClick={handleCopy}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
    </Button>
  );
}
