import type { ReactElement } from "react";
import { formatThoughtSeconds } from "../../../../../../../src/protocol/visibleTrace";
import { useLiveNow } from "../../../../liveClock";

/** Live clock in the same form as Thinking, for example `Running for 1.2s`. */
export function subagentRunLabel(startedAtMs: number, nowMs: number): string {
  const seconds = formatThoughtSeconds(Math.max(0, nowMs - startedAtMs));
  return seconds.length > 0 ? `Running for ${seconds}` : "Running";
}

export function SubagentRunTimer({ startedAtMs }: { startedAtMs: number }): ReactElement {
  const nowMs = useLiveNow(true);
  return <>{subagentRunLabel(startedAtMs, nowMs)}</>;
}
