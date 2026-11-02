"use client";

import { Button, Card, CardContent } from "@open-mtlms/core";
import { Check, Copy, ExternalLink, Eye } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface Props {
  academyUrl: string | null;
  sampleCourseSlug?: string | null;
  isLoading?: boolean;
}

export function AcademyLiveCard({
  academyUrl,
  sampleCourseSlug,
  isLoading = false,
}: Props) {
  const [copied, setCopied] = useState(false);
  const samplePreviewUrl =
    academyUrl && sampleCourseSlug
      ? `${academyUrl}/courses/${sampleCourseSlug}`
      : null;
  const display = academyUrl ? academyUrl.replace(/^https?:\/\//, "") : "";
  const actionsDisabled = isLoading || !academyUrl;

  const handleCopy = async () => {
    if (!academyUrl) return;
    try {
      await navigator.clipboard.writeText(academyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore: URL is selectable as text
    }
  };

  return (
    <Card>
      <CardContent className="pb-6 pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Your academy is live
            </div>
            {isLoading || !academyUrl ? (
              <div
                aria-label="Loading academy URL"
                className="mt-2 h-5 w-64 max-w-full animate-pulse rounded bg-muted sm:h-6"
              />
            ) : (
              <div className="mt-1.5 truncate font-mono text-base font-semibold text-foreground sm:text-lg">
                {display}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild={!actionsDisabled}
              size="sm"
              
              disabled={actionsDisabled}
            >
              {actionsDisabled ? (
                <span>
                  <ExternalLink className="mr-1.5 h-4 w-4" /> Visit website
                </span>
              ) : (
                <a href={academyUrl!} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-4 w-4" /> Visit website
                </a>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              disabled={actionsDisabled}
              
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-4 w-4" /> Copy link
                </>
              )}
            </Button>
            {samplePreviewUrl && (
              <Button
                asChild
                size="sm"
                variant="ghost"
                
              >
                <Link href={samplePreviewUrl} target="_blank" rel="noopener noreferrer">
                  <Eye className="mr-1.5 h-4 w-4" /> Preview sample course
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
