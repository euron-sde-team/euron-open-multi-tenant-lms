import { useEffect, useRef, useState } from "react";

/** Cross-fade duration for a position change, in ms. */
const FADE_MS = 500;

/**
 * Adapted from the EVS reference player (Watermark).
 *  Client-side, repositioning identity overlay. Pure DOM, NO
 * media changes: it moves to a new pseudo-random spot once a minute so a static
 * crop cannot remove it from the whole timeline. Deterrence, not security.
 *
 * Distraction budget: it holds one spot for a full minute and never travels while
 * visible. A move is a fade-out, an instant jump behind zero opacity, then a
 * fade-in. Sliding the element across the frame is what the eye tracks, so the
 * position change is hidden inside the fade rather than animated.
 */
export function Watermark({
  text,
  intervalMs = 60000,
  opacity = 0.35,
}: {
  text: string;
  intervalMs?: number;
  opacity?: number;
}) {
  const seedRef = useRef<number>((text.length * 2654435761) % 2147483647 || 1);
  const [pos, setPos] = useState({ top: 8, left: 8 });
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const nextRandom = () => {
      let s = seedRef.current;
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      seedRef.current = s;
      return Math.abs(s % 1000) / 1000;
    };
    const reposition = () =>
      setPos({ top: 5 + nextRandom() * 75, left: 5 + nextRandom() * 70 });
    reposition();

    let fadeIn: number | undefined;
    const timer = window.setInterval(() => {
      setShown(false);
      fadeIn = window.setTimeout(() => {
        reposition();
        setShown(true);
      }, FADE_MS);
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
      if (fadeIn !== undefined) window.clearTimeout(fadeIn);
    };
  }, [intervalMs]);

  return (
    <div
      className="pointer-events-none absolute z-30 select-none whitespace-nowrap text-red-500"
      style={{
        top: `${pos.top}%`,
        left: `${pos.left}%`,
        opacity: shown ? opacity : 0,
        fontSize: "clamp(15px, 2.4vw, 21px)",
        textShadow: "0 1px 3px rgba(0,0,0,0.8)",
        transition: `opacity ${FADE_MS}ms ease-in-out`,
      }}
    >
      {text}
    </div>
  );
}
