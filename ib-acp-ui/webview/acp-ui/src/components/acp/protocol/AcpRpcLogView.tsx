import { useEffect, useRef, type ReactElement } from "react";
import type { AcpRpcLogEntry } from "../../../../../../src/protocol/acpRpcLog";
import { prettyPrintAcpRpcJson } from "../../../../../../src/protocol/acpRpcLog";
import "./AcpRpcLogView.css";

function directionLabel(entry: AcpRpcLogEntry): string {
    if (entry.direction === "toAgent") {
        return entry.agentName !== undefined && entry.agentName.length > 0
            ? `→ ${entry.agentName}`
            : "→ Agent";
    }
    return entry.agentName !== undefined && entry.agentName.length > 0
        ? `← ${entry.agentName}`
        : "← Agent";
}

export function AcpRpcLogView({ entries }: { entries: readonly AcpRpcLogEntry[] }): ReactElement {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el === null || !stickToBottomRef.current) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [entries]);

  return (
    <div
      ref={scrollRef}
      className="acp-rpc-log"
      onScroll={(event) => {
        const el = event.currentTarget;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        stickToBottomRef.current = distanceFromBottom <= 32;
      }}
    >
      {entries.length === 0 ? (
        <p className="acp-rpc-log-empty">No protocol traffic yet. Send a message to stream RPC here.</p>
      ) : (
        <ol className="acp-rpc-log-list">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={
                entry.direction === "toAgent" ? "acp-rpc-log-entry acp-rpc-log-entry--out" : "acp-rpc-log-entry acp-rpc-log-entry--in"
              }
            >
              <div className="acp-rpc-log-entry-head">
                <span className="acp-rpc-log-direction">{directionLabel(entry)}</span>
              </div>
              <pre className="acp-rpc-log-payload">{prettyPrintAcpRpcJson(entry.raw)}</pre>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}