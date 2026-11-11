import { type ReactElement, useEffect, useState } from "react";
import { formatThoughtSeconds } from "../../../../../../../src/protocol/visibleTrace";

/** Live clock in the same form as Thinking, for example `Running for 1.2s`. */
export function subagentRunLabel(startedAtMs: number, nowMs: number): string {
  const seconds = formatThoughtSeconds(Math.max(0, nowMs - startedAtMs));
  return seconds.length > 0 ? `Running for ${seconds}` : "Running";
}

export function SubagentRunTimer({ startedAtMs }: { startedAtMs: number }): ReactElement {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const handle = window.setInterval(() => {
      setNowMs(Date.now());
    }, 100);
    return () => {
      window.clearInterval(handle);
    };
  }, []);
  return <>{subagentRunLabel(startedAtMs, nowMs)}</>;
}
