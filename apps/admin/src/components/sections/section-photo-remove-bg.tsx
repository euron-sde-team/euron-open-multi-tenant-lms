"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@open-mtlms/core";
import { Eraser, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * The "remove background" action, in its own module ON PURPOSE.
 *
 * @imgly/background-removal drags in onnxruntime-web, whose ESM uses
 * `import.meta` and ships a Node build the client minifier cannot parse. The
 * photo layer is imported by section-wrapper, which IS server rendered, so
 * putting the import there pulled onnxruntime into the server graph and broke
 * `pnpm build` with a bare "Syntax Error" from Terser on ort.node.min.mjs.
 *
 * Loading THIS file through next/dynamic with `ssr: false` (see the layer)
 * keeps the model in a browser only chunk, the same way ThumbnailCanvas does
 * it for react-konva. Nothing is uploaded to a third party and no AI credit is
 * spent: the model runs in the visitor's own browser.
 */
export default function RemoveBackgroundButton({
  url,
  busy,
  onCutout,
  onError,
  onStatus,
}: {
  url: string;
  /** True while the CALLER is uploading the finished cut out. */
  busy: boolean;
  /** Called with the cut out PNG. The caller uploads and saves it. */
  onCutout: (file: File) => void;
  onError: (message: string) => void;
  /** Progress for the overlay on the photo. null means finished. */
  onStatus: (status: string | null) => void;
}) {
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    // Said immediately: the first run downloads the model (tens of MB) before
    // anything visible happens, and without this the button looked dead.
    onStatus("Starting");
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(url, {
        progress: (key, current, total) => {
          const pct = total > 0 ? Math.round((current / total) * 100) : 0;
          // `key` looks like "fetch:/models/isnet" on the first run and
          // "compute:inference" afterwards.
          onStatus(
            key.startsWith("fetch")
              ? `Getting ready ${pct}%`
              : `Removing background ${pct}%`
          );
        },
      });
      onStatus("Saving");
      onCutout(new File([blob], "cutout.png", { type: "image/png" }));
    } catch (err) {
      onStatus(null);
      onError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setRunning(false);
    }
  };

  const working = running || busy;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted grid h-7 w-7 place-items-center rounded disabled:opacity-60"
          onClick={run}
          disabled={working}
          aria-busy={working}
        >
          {working ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eraser className="h-3.5 w-3.5" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {working ? "Working on it" : "Remove background"}
      </TooltipContent>
    </Tooltip>
  );
}
