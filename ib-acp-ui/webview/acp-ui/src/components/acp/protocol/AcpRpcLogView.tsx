import { useEffect, useRef, type ReactElement } from "react";
import type { AcpRpcDisplayMessage, AcpRpcLogEntry } from "../../../../../../src/protocol/acpRpcLog";
import { formatAcpRpcDisplay } from "../../../../../../src/protocol/acpRpcLog";
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

function RpcPayloadBody({ message }: { message: AcpRpcDisplayMessage }): ReactElement {
    if (message.raw !== undefined) {
        return <pre className="acp-rpc-log-payload">{message.raw}</pre>;
    }

    return (
        <div className="acp-rpc-log-body">
            {message.method !== undefined ? (
                <div className="acp-rpc-log-field acp-rpc-log-field--method">
                    <span className="acp-rpc-log-label">method:</span>
                    <span className="acp-rpc-log-value">{message.method}</span>
                </div>
            ) : null}
            {message.params !== undefined ? (
                <div className="acp-rpc-log-field">
                    <span className="acp-rpc-log-label">params:</span>
                    <pre className="acp-rpc-log-json">{message.params}</pre>
                </div>
            ) : null}
            {message.result !== undefined ? (
                <div className="acp-rpc-log-field">
                    <span className="acp-rpc-log-label">result:</span>
                    <pre className="acp-rpc-log-json">{message.result}</pre>
                </div>
            ) : null}
            {message.error !== undefined ? (
                <div className="acp-rpc-log-field">
                    <span className="acp-rpc-log-label">error:</span>
                    <pre className="acp-rpc-log-json">{message.error}</pre>
                </div>
            ) : null}
        </div>
    );
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
                                entry.direction === "toAgent"
                                    ? "acp-rpc-log-entry acp-rpc-log-entry--out"
                                    : "acp-rpc-log-entry acp-rpc-log-entry--in"
                            }
                        >
                            <div className="acp-rpc-log-entry-head">
                                <span className="acp-rpc-log-direction">{directionLabel(entry)}</span>
                            </div>
                            <RpcPayloadBody message={formatAcpRpcDisplay(entry.raw)} />
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}