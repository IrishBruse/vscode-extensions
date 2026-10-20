const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

/** Short "5 minutes ago" label for recent-chat timestamps; falls back to a date past a week. */
export function formatRelativeTime(timestampMs: number, nowMs: number = Date.now()): string {
  const deltaMs = nowMs - timestampMs;
  if (deltaMs < minuteMs) {
    return "just now";
  }
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (deltaMs < hourMs) {
    return formatter.format(-Math.floor(deltaMs / minuteMs), "minute");
  }
  if (deltaMs < dayMs) {
    return formatter.format(-Math.floor(deltaMs / hourMs), "hour");
  }
  if (deltaMs < 7 * dayMs) {
    return formatter.format(-Math.floor(deltaMs / dayMs), "day");
  }
  return new Date(timestampMs).toLocaleDateString();
}
