/** Thoughts and tool calls form one visual group in the transcript. */
export function isActivityTraceType(type: string): boolean {
  return type === "thought" || type === "tool";
}

/**
 * Inclusive ranges of consecutive thought and tool rows.
 * User text, agent text, and plans stay outside those ranges.
 */
export function activityGroupRanges(
  kinds: readonly string[],
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let start = -1;
  for (let index = 0; index < kinds.length; index++) {
    if (isActivityTraceType(kinds[index] ?? "")) {
      if (start < 0) {
        start = index;
      }
      continue;
    }
    if (start >= 0) {
      ranges.push({ start, end: index - 1 });
      start = -1;
    }
  }
  if (start >= 0) {
    ranges.push({ start, end: kinds.length - 1 });
  }
  return ranges;
}
