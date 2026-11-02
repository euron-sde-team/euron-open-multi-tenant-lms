"use client";

import { Button } from "@open-mtlms/core";
import { ExternalLink, Globe, PartyPopper } from "lucide-react";

interface LaunchSuccessProps {
  websiteUrl: string;
  onGoToPages: () => void;
}

export function LaunchSuccess({ websiteUrl, onGoToPages }: LaunchSuccessProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center space-y-6 py-8 text-center">
      {/* Celebration icon */}
      <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-2xl">
        <PartyPopper className="text-primary h-8 w-8" />
      </div>

      <div>
        <h2 className="text-2xl font-bold">Your Website is Live!</h2>
        <p className="text-muted-foreground mt-2 max-w-md text-sm">
          All pages have been created, customized, and published. Your website is ready for visitors.
        </p>
      </div>

      {/* URL display */}
      <div className="bg-muted/50 flex items-center gap-3 rounded-xl border px-6 py-4">
        <Globe className="text-primary h-5 w-5 flex-shrink-0" />
        <span className="font-mono text-sm font-medium break-all">{websiteUrl}</span>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Visit Website
          </a>
        </Button>
        <Button variant="outline" onClick={onGoToPages}>
          Go to Pages
        </Button>
      </div>
    </div>
  );
}
