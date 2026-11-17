import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { formatPathWithTilde } from "../../../../../../src/platform/pathDisplay";
import type { AcpRpcDisplayField, AcpRpcDisplayMessage, AcpRpcLogEntry } from "../../../../../../src/protocol/acpRpcLog";
import { formatAcpRpcDisplay } from "../../../../../../src/protocol/acpRpcLog";
import { renderHighlightedCode } from "../trace/AgentMarkdown/codeHighlighting";
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

function RpcLabeledField({ label, children }: { label: string; children: ReactNode }): ReactElement {
    return (
        <div className="acp-rpc-log-field">
            <span className="acp-rpc-log-label">{label}</span>
            {children}
        </div>
    );
}

function JsonBlock({ json }: { json: string }): ReactElement {
    return (
        <pre className="acp-rpc-log-json">
            <code>{renderHighlightedCode("json", json)}</code>
        </pre>
    );
}

function RpcDisplayField({ field }: { field: AcpRpcDisplayField }): ReactElement {
    if (field.kind === "scalar") {
        return (
            <RpcLabeledField label={field.label}>
                <span className="acp-rpc-log-value">{field.value}</span>
            </RpcLabeledField>
        );
    }
    return (
        <RpcLabeledField label={field.label}>
            <JsonBlock json={field.value} />
        </RpcLabeledField>
    );
}

function entryHeadTitle(message: AcpRpcDisplayMessage): string {
    if (message.title !== undefined && message.title.length > 0) {
        return message.title;
    }
    const method = message.fields?.find((field) => field.label === "method");
    if (method?.kind === "scalar" && method.value.length > 0) {
        return method.value;
    }
    if (message.rpcId !== undefined) {
        return "response";
    }
    return "RPC";
}

function RpcPayloadBody({ message }: { message: AcpRpcDisplayMessage }): ReactElement {
    if (message.raw !== undefined) {
        return (
            <pre className="acp-rpc-log-payload">
                <code>{renderHighlightedCode("json", message.raw)}</code>
            </pre>
        );
    }

    return (
        <div className="acp-rpc-log-body">
            {message.fields?.map((field, index) => (
                <RpcDisplayField key={`${field.label}-${index}`} field={field} />
            ))}
        </div>
    );
}

function ChevronIcon({ expanded }: { expanded: boolean }): ReactElement {
    return (
        <svg
            className={expanded ? "acp-rpc-log-chevron acp-rpc-log-chevron--open" : "acp-rpc-log-chevron"}
            viewBox="0 0 16 16"
            aria-hidden="true"
        >
            <path
                fill="currentColor"
                d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 1 1-1.06-1.06L8.69 8 6.22 5.56a.75.75 0 0 1 0-1.06Z"
            />
        </svg>
    );
}

export type AcpRpcLogViewProps = {
    entries: readonly AcpRpcLogEntry[];
    /** Absolute path of the session RPC log file on disk. */
    logPath?: string;
    homeDir?: string;
};

export function AcpRpcLogView({ entries, logPath, homeDir }: AcpRpcLogViewProps): ReactElement {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const stickToBottomRef = useRef(true);
    const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<number>>(() => new Set());
    const seenEntryIdsRef = useRef<Set<number>>(new Set());
    const [pathCopied, setPathCopied] = useState(false);

    useEffect(() => {
        if (entries.length === 0) {
            seenEntryIdsRef.current = new Set();
            return;
        }
        setCollapsedIds((prev) => {
            const next = new Set(prev);
            let changed = false;
            for (const entry of entries) {
                if (seenEntryIdsRef.current.has(entry.id)) {
                    continue;
                }
                seenEntryIdsRef.current.add(entry.id);
                const message = formatAcpRpcDisplay(entry.raw);
                if (message.defaultCollapsed === true) {
                    next.add(entry.id);
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [entries]);

    useEffect(() => {
        const el = scrollRef.current;
        if (el === null || !stickToBottomRef.current) {
            return;
        }
        el.scrollTop = el.scrollHeight;
    }, [entries]);

    const toggleEntry = useCallback((entryId: number) => {
        setCollapsedIds((prev) => {
            const next = new Set(prev);
            if (next.has(entryId)) {
                next.delete(entryId);
            } else {
                next.add(entryId);
            }
            return next;
        });
    }, []);

    const logPathLabel =
        logPath !== undefined && logPath.length > 0
            ? formatPathWithTilde(
                  logPath,
                  homeDir !== undefined && homeDir.length > 0 ? homeDir : "",
              )
            : undefined;

    const copyLogPath = useCallback(async (): Promise<void> => {
        if (logPath === undefined || logPath.length === 0) {
            return;
        }
        if (navigator.clipboard?.writeText !== undefined) {
            await navigator.clipboard.writeText(logPath);
        }
        setPathCopied(true);
        window.setTimeout(() => {
            setPathCopied(false);
        }, 1500);
    }, [logPath]);

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
            {logPathLabel !== undefined ? (
                <button
                    type="button"
                    className="acp-rpc-log-path"
                    title="Copy log file path"
                    onClick={() => {
                        void copyLogPath();
                    }}
                >
                    {pathCopied ? "Copied path" : logPathLabel}
                </button>
            ) : null}
            {entries.length === 0 ? (
                <p className="acp-rpc-log-empty">No protocol traffic yet. Send a message to stream RPC here.</p>
            ) : (
                <ol className="acp-rpc-log-list">
                    {entries.map((entry) => {
                        const message = formatAcpRpcDisplay(entry.raw);
                        const headTitle = entryHeadTitle(message);
                        const expanded = !collapsedIds.has(entry.id);
                        return (
                            <li
                                key={entry.id}
                                className={
                                    entry.direction === "toAgent"
                                        ? "acp-rpc-log-entry acp-rpc-log-entry--out"
                                        : "acp-rpc-log-entry acp-rpc-log-entry--in"
                                }
                            >
                                <button
                                    type="button"
                                    className="acp-rpc-log-entry-head"
                                    aria-expanded={expanded}
                                    onClick={() => {
                                        toggleEntry(entry.id);
                                    }}
                                >
                                    <ChevronIcon expanded={expanded} />
                                    <span className="acp-rpc-log-direction">{directionLabel(entry)}</span>
                                    <span className="acp-rpc-log-title">{headTitle}</span>
                                    {message.rpcId !== undefined ? (
                                        <span className="acp-rpc-log-id">{message.rpcId}</span>
                                    ) : null}
                                </button>
                                {expanded ? <RpcPayloadBody message={message} /> : null}
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}