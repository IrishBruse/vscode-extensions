import { useEffect, useState } from "react";
import { liveClockIntervalMs } from "../../../src/protocol/liveClock";

type LiveClockListener = (nowMs: number) => void;

const listeners = new Set<LiveClockListener>();
let localTimer: number | undefined;
let lastHostAt = 0;
let postActive: ((active: boolean) => void) | undefined;

const hostFreshMs = liveClockIntervalMs * 3;

/** Lets the VS Code host push ticks while a timer is on screen. */
export function bindLiveClockTransport(post: (active: boolean) => void): void {
  postActive = post;
}

/** Applies a clock sample from the extension host. */
export function publishHostClock(nowMs: number): void {
  if (!Number.isFinite(nowMs)) {
    return;
  }
  lastHostAt = Date.now();
  for (const listener of listeners) {
    listener(nowMs);
  }
}

function notify(nowMs: number): void {
  for (const listener of listeners) {
    listener(nowMs);
  }
}

function ensureLocalTimer(): void {
  if (localTimer !== undefined || listeners.size === 0 || typeof window === "undefined") {
    return;
  }
  localTimer = window.setInterval(() => {
    if (lastHostAt !== 0 && Date.now() - lastHostAt < hostFreshMs) {
      return;
    }
    notify(Date.now());
  }, liveClockIntervalMs);
}

function stopLocalTimer(): void {
  if (localTimer === undefined || typeof window === "undefined") {
    return;
  }
  window.clearInterval(localTimer);
  localTimer = undefined;
}

export function subscribeLiveClock(listener: LiveClockListener): () => void {
  const wasEmpty = listeners.size === 0;
  listeners.add(listener);
  ensureLocalTimer();
  if (wasEmpty) {
    postActive?.(true);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) {
      return;
    }
    stopLocalTimer();
    lastHostAt = 0;
    postActive?.(false);
  };
}

/** Current time while `active` is true. The value moves once per tenth of a second. */
export function useLiveNow(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) {
      return;
    }
    return subscribeLiveClock((next) => {
      setNowMs((current) =>
        Math.floor(current / liveClockIntervalMs) === Math.floor(next / liveClockIntervalMs)
          ? current
          : next,
      );
    });
  }, [active]);
  return nowMs;
}
