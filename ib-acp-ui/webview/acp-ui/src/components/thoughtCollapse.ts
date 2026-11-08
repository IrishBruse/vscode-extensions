export type VerticalSpan = {
  top: number;
  bottom: number;
};

/**
 * Index of the thought row to close when a later thought row appears.
 * Returns undefined when the same thought is still streaming, when there is no
 * earlier thought, or when the user has scrolled up and that earlier row is on screen.
 */
export function previousThoughtIndexToCollapse(input: {
  previousThoughtIndexes: readonly number[];
  nextThoughtIndexes: readonly number[];
  followBottom: boolean;
  previousThoughtInView: boolean;
}): number | undefined {
  if (input.previousThoughtIndexes.length === 0) {
    return undefined;
  }
  const seen = new Set(input.previousThoughtIndexes);
  const addedThought = input.nextThoughtIndexes.some((index) => !seen.has(index));
  if (!addedThought) {
    return undefined;
  }
  const previous = input.previousThoughtIndexes[input.previousThoughtIndexes.length - 1];
  if (previous === undefined || !input.nextThoughtIndexes.includes(previous)) {
    return undefined;
  }
  if (!input.followBottom && input.previousThoughtInView) {
    return undefined;
  }
  return previous;
}

/** True when the row overlaps the visible scrollport, including a partial overlap. */
export function rectIntersectsScrollport(row: VerticalSpan, scrollport: VerticalSpan): boolean {
  return row.bottom > scrollport.top && row.top < scrollport.bottom;
}

/** True when the whole row sits above the visible scrollport. */
export function rectIsFullyAboveScrollport(row: VerticalSpan, scrollport: VerticalSpan): boolean {
  return row.bottom <= scrollport.top;
}
