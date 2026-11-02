"use client";

import { LineChart, Loader2, Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Desmos is loaded at runtime from their CDN; it attaches `Desmos` to window.
interface DesmosInstance {
  destroy: () => void;
  resize?: () => void;
}

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (
        el: HTMLElement,
        opts?: Record<string, unknown>
      ) => DesmosInstance;
    };
  }
}

// The Desmos graphing calculator needs an API key (https://www.desmos.com/api).
// Without NEXT_PUBLIC_DESMOS_API_KEY the calculator is simply not offered.
const DESMOS_KEY = process.env.NEXT_PUBLIC_DESMOS_API_KEY ?? "";
const DESMOS_SRC = `https://www.desmos.com/api/v1.10/calculator.js?apiKey=${encodeURIComponent(DESMOS_KEY)}`;

let desmosPromise: Promise<void> | null = null;
function loadDesmos(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (!DESMOS_KEY) return Promise.reject(new Error("graphing calculator not configured"));
  if (window.Desmos) return Promise.resolve();
  if (desmosPromise) return desmosPromise;
  desmosPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-desmos="1"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("desmos load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = DESMOS_SRC;
    s.async = true;
    s.dataset.desmos = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("desmos load failed"));
    document.head.appendChild(s);
  });
  return desmosPromise;
}

/**
 * Bluebook-style Desmos graphing calculator. Default is a draggable, closable
 * floating panel; `docked` renders it as a static full-height pane (the
 * Bluebook player docks it beside the question so nothing overlaps, with the
 * expression list + keypad fully visible). Desmos is loaded lazily from their
 * CDN. If it can't load (offline), the caller's scientific calculator remains
 * available; we show a hint here.
 */
export function GraphingCalculator({
  onClose,
  docked = false,
  expanded = false,
  onToggleExpand,
  bare = false,
}: {
  onClose?: () => void;
  docked?: boolean;
  /** Docked only: Bluebook-style enlarge, big, but never the whole screen. */
  expanded?: boolean;
  onToggleExpand?: () => void;
  /** Render only the calculator surface, the caller owns the chrome/header. */
  bare?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<DesmosInstance | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pos, setPos] = useState({ x: 80, y: 96 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDesmos()
      .then(() => {
        if (cancelled || !hostRef.current || !window.Desmos) return;
        calcRef.current = window.Desmos.GraphingCalculator(hostRef.current, {
          keypad: true,
          expressions: true,
          settingsMenu: false,
          border: false,
          lockViewport: false,
        });
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
      try {
        calcRef.current?.destroy();
      } catch {
        /* noop */
      }
      calcRef.current = null;
    };
  }, []);

  // Desmos only watches window resize; the dock changes size on mount,
  // expand/shrink and layout reflow, which otherwise leaves the graph
  // misaligned/stretched. Re-measure on every container size change.
  useEffect(() => {
    if (!hostRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => calcRef.current?.resize?.());
    ro.observe(hostRef.current);
    return () => ro.disconnect();
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    const move = (ev: MouseEvent) => {
      if (!drag.current) return;
      setPos({ x: ev.clientX - drag.current.dx, y: ev.clientY - drag.current.dy });
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const surface = (
    <div className="relative flex-1">
      {status === "loading" && (
        <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading graphing calculator…
        </div>
      )}
      {status === "error" && (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center p-6 text-center text-sm">
          Couldn&apos;t load the graphing calculator (check your connection).
          The scientific calculator is still available.
        </div>
      )}
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );

  if (bare) {
    return <div className="flex h-full w-full flex-col">{surface}</div>;
  }

  return (
    <div
      className={
        docked
          ? "bg-card flex h-full w-full flex-col overflow-hidden"
          : "bg-card border-border fixed z-50 flex h-[28rem] w-[26rem] flex-col overflow-hidden rounded-xl border shadow-2xl"
      }
      style={docked ? undefined : { left: pos.x, top: pos.y }}
    >
      <div
        onMouseDown={docked ? undefined : onMouseDown}
        className={
          docked
            ? "bg-muted/60 flex items-center justify-between px-3 py-2"
            : "bg-muted/60 flex cursor-move items-center justify-between px-3 py-2"
        }
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <LineChart className="h-3.5 w-3.5" /> Graphing calculator
        </span>
        <span className="flex items-center gap-2">
          {docked && onToggleExpand && (
            <button
              onClick={onToggleExpand}
              aria-label={expanded ? "Shrink calculator" : "Expand calculator"}
              title={expanded ? "Shrink" : "Expand"}
              className="text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close graphing calculator"
            className="hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </span>
      </div>
      {surface}
    </div>
  );
}
