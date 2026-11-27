import { useLayoutEffect, useState, type RefObject } from "react";
import {
  virtualTraceFallbackViewportPx,
  virtualTraceTotalHeight,
  virtualTraceWindow,
  type VirtualTraceWindow,
} from "./virtualTraceWindow";

const pinnedSlackPx = 48;

function marginBoxHeight(node: HTMLElement): number {
  const style = getComputedStyle(node);
  const marginTop = Number.parseFloat(style.marginTop);
  const marginBottom = Number.parseFloat(style.marginBottom);
  return (
    node.offsetHeight +
    (Number.isFinite(marginTop) ? marginTop : 0) +
    (Number.isFinite(marginBottom) ? marginBottom : 0)
  );
}

function localScrollTop(scroll: HTMLElement, container: HTMLElement): number {
  const top =
    container.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
  return scroll.scrollTop - top;
}

function scrollIsPinned(scroll: HTMLElement): boolean {
  return scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= pinnedSlackPx;
}

function sameWindow(left: VirtualTraceWindow, right: VirtualTraceWindow): boolean {
  return (
    left.start === right.start &&
    left.end === right.end &&
    left.paddingTop === right.paddingTop &&
    left.paddingBottom === right.paddingBottom
  );
}

function heightFor(
  index: number,
  heights: ReadonlyMap<number, number>,
  estimateAt: (index: number) => number,
): number {
  return heights.get(index) ?? estimateAt(index);
}

/**
 * Mounts only the trace rows near the scrollport once the list is long.
 * Short lists keep every row.
 */
export function useVirtualTraceWindow(args: {
  enabled: boolean;
  count: number;
  estimateAt: (index: number) => number;
  scrollRef: RefObject<HTMLElement | null>;
  historyCommit: number;
  followBottom: boolean;
}): { containerRef: (node: HTMLDivElement | null) => void; window: VirtualTraceWindow | null } {
  const { enabled, count, estimateAt, scrollRef, historyCommit, followBottom } = args;
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<{
    commit: number;
    heights: ReadonlyMap<number, number>;
  }>({ commit: historyCommit, heights: new Map() });
  const [window, setWindow] = useState<VirtualTraceWindow | null>(null);

  let heights = measured.heights;
  if (measured.commit !== historyCommit) {
    heights = new Map();
    setMeasured({ commit: historyCommit, heights });
  }

  const heightAt = (index: number): number => heightFor(index, heights, estimateAt);

  useLayoutEffect(() => {
    if (!enabled || container === null) {
      return;
    }
    const scroll = scrollRef.current;
    if (scroll === null) {
      return;
    }

    const known = new Map(heights);
    let frame = 0;
    const heightAtNow = (index: number): number => heightFor(index, known, estimateAt);
    const publish = (): void => {
      const currentScroll = scrollRef.current;
      if (currentScroll === null) {
        return;
      }
      const viewport = currentScroll.clientHeight;
      if (viewport <= 0) {
        return;
      }
      const total = virtualTraceTotalHeight(count, heightAtNow);
      const pinned = scrollIsPinned(currentScroll);
      const scrollTop = pinned
        ? Math.max(0, total - viewport)
        : localScrollTop(currentScroll, container);
      const next = virtualTraceWindow({
        count,
        heightAt: heightAtNow,
        scrollTop,
        viewportHeight: viewport,
      });
      setWindow((current) => (current !== null && sameWindow(current, next) ? current : next));
    };
    const schedule = (): void => {
      if (frame !== 0) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        publish();
      });
    };

    const rowObserver = new ResizeObserver((entries) => {
      const currentScroll = scrollRef.current;
      if (currentScroll === null) {
        return;
      }
      const pinned = scrollIsPinned(currentScroll);
      let deltaAbove = 0;
      const local = localScrollTop(currentScroll, container);
      let changed = false;
      for (const entry of entries) {
        const node = entry.target;
        if (!(node instanceof HTMLElement)) {
          continue;
        }
        const index = Number(node.dataset.virtualIndex);
        if (!Number.isInteger(index)) {
          continue;
        }
        const nextHeight = marginBoxHeight(node);
        const previousHeight = heightAtNow(index);
        if (nextHeight === previousHeight) {
          continue;
        }
        let top = 0;
        for (let cursor = 0; cursor < index; cursor++) {
          top += heightAtNow(cursor);
        }
        known.set(index, nextHeight);
        changed = true;
        if (!pinned && top < local) {
          deltaAbove += nextHeight - previousHeight;
        }
      }
      if (!changed) {
        return;
      }
      setMeasured({ commit: historyCommit, heights: new Map(known) });
      if (deltaAbove !== 0) {
        currentScroll.scrollTop += deltaAbove;
      }
      publish();
    });

    for (const child of container.children) {
      if (child instanceof HTMLElement) {
        rowObserver.observe(child);
      }
    }
    const scrollObserver = new ResizeObserver(schedule);
    scrollObserver.observe(scroll);
    scroll.addEventListener("scroll", schedule, { passive: true });
    publish();

    return () => {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
      rowObserver.disconnect();
      scrollObserver.disconnect();
      scroll.removeEventListener("scroll", schedule);
    };
  }, [container, count, enabled, estimateAt, heights, historyCommit, scrollRef]);

  if (!enabled) {
    return { containerRef: setContainer, window: null };
  }
  if (window !== null && window.end <= count && measured.commit === historyCommit) {
    return { containerRef: setContainer, window };
  }
  const viewport = virtualTraceFallbackViewportPx;
  const total = virtualTraceTotalHeight(count, heightAt);
  return {
    containerRef: setContainer,
    window: virtualTraceWindow({
      count,
      heightAt,
      scrollTop: followBottom ? Math.max(0, total - viewport) : 0,
      viewportHeight: viewport,
    }),
  };
}
