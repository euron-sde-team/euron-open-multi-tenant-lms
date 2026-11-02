"use client";

import { useEffect, useState } from "react";

import {
  attemptStaleDeployRecovery,
  isStaleDeployError,
} from "@/lib/utils/stale-deploy";

// Segment-level boundary: keeps the root layout (header, theme, providers)
// alive when a page crashes, instead of escalating to global-error which
// blanks the entire site.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    console.error("[page-error]", error.digest ?? "", error);
    if (isStaleDeployError(error) && attemptStaleDeployRecovery()) {
      setRecovering(true);
    }
  }, [error]);

  if (recovering) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-muted-foreground text-sm">Updating to the latest version…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-foreground text-2xl font-bold">
          Something went wrong
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          An unexpected error occurred. Please try again.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="border-border text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}
