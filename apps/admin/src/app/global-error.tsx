"use client";

import { useEffect } from "react";

function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { name?: string; message?: string };
  return (
    err.name === "ChunkLoadError" ||
    /Loading chunk \S+ failed/i.test(err.message ?? "") ||
    /Loading CSS chunk \S+ failed/i.test(err.message ?? "") ||
    /Failed to fetch dynamically imported module/i.test(err.message ?? "")
  );
}

const RELOAD_FLAG = "lms_admin_chunk_reload_at";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (!chunkError) return;
    if (typeof window === "undefined") return;

    // Guard against reload storms: only auto-reload if we haven't reloaded
    // for this reason in the last 30 seconds.
    try {
      const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
      if (Date.now() - last < 30_000) return;
      sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    } catch {
      // sessionStorage unavailable, fall through and reload anyway
    }

    window.location.reload();
  }, [chunkError]);

  return (
    <html lang="en">
      <body className="bg-background font-sans antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
          <div className="max-w-md text-center">
            <h1 className="text-foreground text-2xl font-bold">
              {chunkError ? "Updating to the latest version" : "Something went wrong"}
            </h1>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              {chunkError
                ? "We just shipped an update. Reloading to pick up the new version."
                : "An unexpected error occurred. Please try again."}
            </p>
          </div>

          <button
            onClick={() => {
              if (chunkError && typeof window !== "undefined") {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm transition-colors"
          >
            {chunkError ? "Reload now" : "Try again"}
          </button>
        </div>
      </body>
    </html>
  );
}
