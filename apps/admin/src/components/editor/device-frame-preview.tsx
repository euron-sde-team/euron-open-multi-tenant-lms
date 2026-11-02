"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LIVE_PREVIEW_MESSAGE, LIVE_PREVIEW_READY } from "@/lib/preview-messages";

interface DeviceFramePreviewProps {
  /** URL loaded into the preview iframe. */
  src: string;
  /** Human label, e.g. "iPhone 14". */
  label: string;
  /** Device logical viewport width in CSS px. */
  width: number;
  /** Device logical viewport height in CSS px. */
  height: number;
  /**
   * Optional data pushed into the iframe via same-origin postMessage. Used by the
   * live page preview so device frames render the editor's current state. When
   * omitted, the iframe is a plain URL preview with no messaging (unchanged).
   */
  postMessagePayload?: unknown;
}

// Breathing room reserved inside the canvas so the fitted device never touches
// the edges and there's room for the size label below it.
const H_MARGIN = 48; // 24px each side
const V_MARGIN = 96; // top/bottom padding (~48) + label block (~48)

/**
 * Device-emulator preview that auto-scales a fixed-size iframe to fit the
 * available canvas (like Chrome DevTools "fit to window").
 *
 * The iframe renders at the true device viewport (width × height) so the page
 * inside sees real device dimensions; a CSS transform then scales the whole
 * frame down to fit. Scale is capped at 1 (never upscale past 100%). A footprint
 * wrapper reserves the *scaled* size in layout so centering stays correct and no
 * scrollbars appear when it fits.
 */
export function DeviceFramePreview({
  src,
  label,
  width,
  height,
  postMessagePayload,
}: DeviceFramePreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);

  // Always hold the latest payload so the "ready" handshake and onLoad can post
  // the current state (not a stale closure value).
  const payloadRef = useRef<unknown>(postMessagePayload);
  payloadRef.current = postMessagePayload;

  // Push the current page state into the iframe (same-origin). No-op when there's
  // no payload (plain URL preview) or the iframe hasn't mounted yet.
  const postPayload = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || payloadRef.current === undefined) return;
    win.postMessage(
      { type: LIVE_PREVIEW_MESSAGE, payload: payloadRef.current },
      window.location.origin,
    );
  }, []);

  // Re-send whenever the payload changes (edits / theme / layout).
  useEffect(() => {
    if (postMessagePayload === undefined) return;
    postPayload();
  }, [postMessagePayload, postPayload]);

  // The iframe announces READY on mount (incl. after a reload); respond with the
  // current state so nothing is lost if the child mounts after our first send.
  useEffect(() => {
    if (postMessagePayload === undefined) return;
    const onReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string })?.type === LIVE_PREVIEW_READY) {
        postPayload();
      }
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
    // postMessagePayload intentionally in deps so the listener is (re)attached
    // once messaging is enabled; postPayload reads the latest via the ref.
  }, [postMessagePayload, postPayload]);

  useEffect(() => {
    const root = rootRef.current;
    // Measure the scroll container (the <main> canvas this renders into). Its
    // clientHeight is the stable *visible* height, so observing it avoids a
    // feedback loop with our own (content-sized) height.
    const canvas = root?.parentElement;
    if (!root || !canvas) return;

    const compute = () => {
      const availW = canvas.clientWidth - H_MARGIN;
      const availH = canvas.clientHeight - V_MARGIN;
      if (availW <= 0 || availH <= 0) return;
      const next = Math.min(availW / width, availH / height, 1);
      if (Number.isFinite(next) && next > 0) setScale(next);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [width, height]);

  return (
    <div
      ref={rootRef}
      className="flex min-h-full w-full flex-col items-center justify-center py-6"
    >
      {/* Footprint reserves the SCALED size in layout (transform doesn't). */}
      <div
        className="relative shrink-0"
        style={{ width: width * scale, height: height * scale }}
      >
        <div
          className="bg-background border-border absolute left-0 top-0 origin-top-left overflow-hidden rounded-xl border-2 shadow-2xl"
          style={{ width, height, transform: `scale(${scale})` }}
        >
          <iframe
            ref={iframeRef}
            src={src}
            title={`${label} preview`}
            className="block border-0"
            style={{ width, height }}
            onLoad={postPayload}
          />
        </div>
      </div>
      {/* Device label */}
      <div className="mt-3 text-center">
        <span className="text-muted-foreground text-xs font-medium">
          {label}, {width} x {height}
        </span>
      </div>
    </div>
  );
}
