"use client";

import { useEffect, useState } from "react";

import {
  attemptStaleDeployRecovery,
  isStaleDeployError,
} from "@/lib/utils/stale-deploy";

// Last-resort boundary (replaces the whole root layout). Reached only when
// the root layout itself throws, page-level errors are caught by error.tsx.
// reset() cannot fix a session stranded by a new deployment, so the primary
// action here is a hard reload that picks up the current build.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    console.error("[global-error]", error.digest ?? "", error);
    if (isStaleDeployError(error) && attemptStaleDeployRecovery()) {
      setRecovering(true);
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background font-sans antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
          {recovering ? (
            <p className="text-muted-foreground text-sm">
              Updating to the latest version…
            </p>
          ) : (
            <>
              <div className="max-w-md text-center">
                <h1 className="text-foreground text-2xl font-bold">
                  Something went wrong
                </h1>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  An unexpected error occurred. Please try again.
                </p>
              </div>

              <button
                onClick={() => window.location.reload()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm transition-colors"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </body>
    </html>
  );
}
