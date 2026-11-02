const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const YEAR = 365 * DAY;

export function formatTimeAgo(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000
  );

  if (seconds < MINUTE) return "now";
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m`;
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h`;
  if (seconds < WEEK) return `${Math.floor(seconds / DAY)}d`;
  if (seconds < YEAR) return `${Math.floor(seconds / WEEK)}w`;
  return `${Math.floor(seconds / YEAR)}y`;
}
