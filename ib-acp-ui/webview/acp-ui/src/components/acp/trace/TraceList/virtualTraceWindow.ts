/** Rows below this count stay fully mounted. */
export const virtualTraceMinRows = 40;

export const virtualTraceOverscanPx = 800;

export const virtualTraceFallbackViewportPx = 640;

export type VirtualTraceWindow = {
  start: number;
  end: number;
  paddingTop: number;
  paddingBottom: number;
};

export function virtualTraceWindow(input: {
  count: number;
  heightAt: (index: number) => number;
  scrollTop: number;
  viewportHeight: number;
  overscanPx?: number;
}): VirtualTraceWindow {
  const count = input.count;
  if (count <= 0) {
    return { start: 0, end: 0, paddingTop: 0, paddingBottom: 0 };
  }
  const overscan = input.overscanPx ?? virtualTraceOverscanPx;
  const offsets: number[] = [0];
  for (let index = 0; index < count; index++) {
    const height = input.heightAt(index);
    offsets.push(offsets[index]! + (height > 0 ? height : 0));
  }
  const total = offsets[count]!;
  const viewStart = Math.max(0, input.scrollTop - overscan);
  const viewEnd = input.scrollTop + Math.max(input.viewportHeight, 0) + overscan;
  let start = 0;
  while (start < count && offsets[start + 1]! <= viewStart) {
    start += 1;
  }
  let end = start;
  while (end < count && offsets[end]! < viewEnd) {
    end += 1;
  }
  if (end <= start) {
    end = Math.min(count, start + 1);
  }
  return {
    start,
    end,
    paddingTop: offsets[start]!,
    paddingBottom: Math.max(0, total - offsets[end]!),
  };
}

export function virtualTraceTotalHeight(
  count: number,
  heightAt: (index: number) => number,
): number {
  let total = 0;
  for (let index = 0; index < count; index++) {
    const height = heightAt(index);
    if (height > 0) {
      total += height;
    }
  }
  return total;
}
