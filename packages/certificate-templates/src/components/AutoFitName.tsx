"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

/**
 * Auto-fitting recipient name.
 *
 * Every certificate template renders the learner's name at a single, hardcoded
 * font size. That looks great for short names but breaks the layout for long
 * ones: the name wraps onto extra lines and, because the surrounding elements
 * are absolutely positioned on a fixed 1122x793 canvas, the overflow collides
 * with the "has completed" divider, the course title, and the body copy.
 *
 * This component shrinks the name to the largest font size at which it still
 * fits within `maxLines` wrapped lines (and, optionally, within `maxHeightPx`
 * of vertical space for the fixed-band layouts). Short names keep the template's
 * intended `maxRem` size; only long names scale down.
 *
 * Why measurement (not a character-count table): whether a name wraps depends on
 * BOTH the font size and the container width at once, and each template has a
 * different width, font family, and letter-spacing. Measuring the real rendered
 * height answers "does this fit?" directly. Line count is monotonic in font size
 * (smaller font -> fewer or equal lines), so a binary search converges quickly.
 *
 * PDF-safe: the certificate view and the downloaded PDF are the same DOM node
 * (the download pipeline snapshots it), so the fitted inline font size is
 * captured identically in both. The fit runs in a layout effect (before paint,
 * so there is never a flash of overflowing text) and re-runs once web fonts
 * finish loading, so the measurement uses real glyph metrics rather than the
 * fallback font's.
 */

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REM_PX = 16;

interface FitConfig {
  maxRem: number;
  minRem: number;
  lineHeight: number;
  maxLines: number;
  maxHeightPx?: number;
}

/**
 * Return the largest font size (px) in [minRem, maxRem] at which `el` renders
 * within `maxLines` lines and `maxHeightPx`. Mutates `el.style.fontSize` while
 * probing; the caller commits the winning size through React state afterwards.
 */
function computeFittedFontPx(el: HTMLElement, cfg: FitConfig): number {
  const maxPx = cfg.maxRem * REM_PX;
  const minPx = cfg.minRem * REM_PX;

  const fits = (sizePx: number): boolean => {
    el.style.fontSize = `${sizePx}px`;
    const lineCount = Math.round(el.scrollHeight / (sizePx * cfg.lineHeight));
    if (lineCount > cfg.maxLines) return false;
    if (cfg.maxHeightPx != null && el.scrollHeight > cfg.maxHeightPx) {
      return false;
    }
    return true;
  };

  // Fast path: the template's intended size already fits (short names).
  if (fits(maxPx)) return maxPx;

  let lo = minPx;
  let hi = maxPx;
  let best = minPx;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

interface AutoFitNameProps {
  /** Full recipient name, already concatenated (first + last). */
  text: string;
  /** The template's design size for short names, in rem (upper bound). */
  maxRem: number;
  /** Smallest size we will shrink to, in rem (lower bound, stays legible). */
  minRem: number;
  /** Unitless line-height applied to the name (used for line measurement). */
  lineHeight: number;
  /** Max wrapped lines before the name must shrink. Defaults to 2. */
  maxLines?: number;
  /** Optional hard pixel ceiling on height, for fixed-band layouts (Editorial). */
  maxHeightPx?: number;
  className?: string;
  /** Passthrough style: font-family, color, weight, letter-spacing, etc. */
  style?: CSSProperties;
}

export function AutoFitName({
  text,
  maxRem,
  minRem,
  lineHeight,
  maxLines = 2,
  maxHeightPx,
  className,
  style,
}: AutoFitNameProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [fontPx, setFontPx] = useState(maxRem * REM_PX);

  const cfg: FitConfig = { maxRem, minRem, lineHeight, maxLines, maxHeightPx };

  // Fit before paint so the name is never shown at an overflowing size.
  useIsomorphicLayoutEffect(() => {
    if (ref.current) setFontPx(computeFittedFontPx(ref.current, cfg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, maxRem, minRem, lineHeight, maxLines, maxHeightPx]);

  // Google Fonts load after first paint (display=swap). Re-fit once they settle
  // so the measurement uses real glyph metrics, not the fallback font's.
  useEffect(() => {
    const fontSet = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fontSet) return;
    let cancelled = false;
    const refit = () => {
      if (!cancelled && ref.current) {
        setFontPx(computeFittedFontPx(ref.current, cfg));
      }
    };
    fontSet.ready.then(refit).catch(() => undefined);
    fontSet.addEventListener?.("loadingdone", refit);
    return () => {
      cancelled = true;
      fontSet.removeEventListener?.("loadingdone", refit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, maxRem, minRem, lineHeight, maxLines, maxHeightPx]);

  return (
    <h2
      ref={ref}
      className={className}
      style={{
        ...style,
        fontSize: `${fontPx}px`,
        lineHeight,
        // Insurance for a single unbroken token that is wider than the box.
        overflowWrap: "break-word",
      }}
    >
      {text}
    </h2>
  );
}
