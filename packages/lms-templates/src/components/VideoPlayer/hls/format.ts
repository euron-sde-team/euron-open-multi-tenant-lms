/** Format seconds as M:SS or H:MM:SS (helper for the HLS player). */
export function formatTime(totalSeconds: number): string {
  let secs = totalSeconds;
  if (!Number.isFinite(secs) || secs < 0) secs = 0;
  const s = Math.floor(secs % 60);
  const m = Math.floor((secs / 60) % 60);
  const h = Math.floor(secs / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
