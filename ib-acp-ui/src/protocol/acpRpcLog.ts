import type { AcpRpcNdjsonDirection } from "../acp/ports/rpcNdjsonSink";

export const maxAcpRpcLogLines = 500;

export const maxAcpRpcTitleLength = 120;

export type AcpRpcLogEntry = {
    id: number;
    direction: AcpRpcNdjsonDirection;
    agentName?: string;
    raw: string;
};

export type AcpRpcDisplayField = {
    label: string;
    kind: "scalar" | "json";
    value: string;
};

/** Structured fields extracted from one NDJSON-RPC line for the in-chat ACP log. */
export type AcpRpcDisplayMessage = {
    /** Short summary for the entry head (tool title, sessionUpdate kind, prompt snippet, …). */
    title?: string;
    /** JSON-RPC request/response id shown in the entry head (not as a body field). */
    rpcId?: string;
    /** Starts collapsed in the ACP log (for example `agent_thought_chunk`). */
    defaultCollapsed?: boolean;
    fields?: readonly AcpRpcDisplayField[];
    raw?: string;
};

const RPC_FIELD_ORDER = ["jsonrpc", "id", "method", "params", "result", "error"] as const;

function prettyJsonBlock(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncateRpcTitle(text: string): string {
    const collapsed = text.replace(/\s+/g, " ").trim();
    if (collapsed.length === 0) {
        return "";
    }
    if (collapsed.length <= maxAcpRpcTitleLength) {
        return collapsed;
    }
    return `${collapsed.slice(0, maxAcpRpcTitleLength - 1).trimEnd()}…`;
}

function textFromAcpContent(content: unknown): string {
    if (typeof content === "string") {
        return content;
    }
    if (!isRecord(content)) {
        return "";
    }
    if (typeof content.text === "string") {
        return content.text;
    }
    return "";
}

function sessionUpdateKind(update: Record<string, unknown>): string | undefined {
    if (typeof update.sessionUpdate === "string" && update.sessionUpdate.length > 0) {
        return update.sessionUpdate;
    }
    return undefined;
}

/** Human-readable summary for one `session/update` payload. */
export function acpSessionUpdateTitle(update: Record<string, unknown>): string | undefined {
    const kind = sessionUpdateKind(update);
    if (kind === undefined) {
        return undefined;
    }

    if (typeof update.title === "string") {
        const title = truncateRpcTitle(update.title);
        if (title.length > 0) {
            return `${kind} · ${title}`;
        }
    }

    const textKinds = new Set([
        "agent_message_chunk",
        "user_message_chunk",
        "session_message_chunk",
    ]);
    if (textKinds.has(kind)) {
        const preview = truncateRpcTitle(textFromAcpContent(update.content));
        if (preview.length > 0) {
            return `${kind} · ${preview}`;
        }
    }

    if (
        kind === "tool_call_update" &&
        typeof update.status === "string" &&
        update.status.length > 0
    ) {
        return `${kind} · ${update.status}`;
    }

    return kind;
}

function scalarString(value: unknown): string {
    if (value === null) {
        return "null";
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return JSON.stringify(value);
}

function pushField(fields: AcpRpcDisplayField[], label: string, value: unknown): void {
    if (value === undefined) {
        return;
    }
    if (typeof value === "object" && value !== null) {
        fields.push({ label, kind: "json", value: prettyJsonBlock(value) });
        return;
    }
    fields.push({ label, kind: "scalar", value: scalarString(value) });
}

function acpRpcSummaryTitle(
    parsed: Record<string, unknown>,
    method: string | undefined,
): string | undefined {
    if (method === "session/update" && isRecord(parsed.params) && isRecord(parsed.params.update)) {
        return acpSessionUpdateTitle(parsed.params.update);
    }

    if (
        method === "session/prompt" &&
        isRecord(parsed.params) &&
        typeof parsed.params.prompt === "string"
    ) {
        const preview = truncateRpcTitle(parsed.params.prompt);
        if (preview.length > 0) {
            return `${method} · ${preview}`;
        }
    }

    if (method === "session/request_permission" && isRecord(parsed.params)) {
        const toolCall = parsed.params.toolCall;
        if (isRecord(toolCall) && typeof toolCall.title === "string") {
            const title = truncateRpcTitle(toolCall.title);
            if (title.length > 0) {
                return `${method} · ${title}`;
            }
        }
    }

    if (method !== undefined) {
        return method;
    }

    if (parsed.result !== undefined) {
        return "response";
    }

    if (parsed.error !== undefined) {
        return "error";
    }

    if (parsed.id !== undefined) {
        return "response";
    }

    return undefined;
}

function buildRpcDisplayFields(parsed: Record<string, unknown>): AcpRpcDisplayField[] {
    const fields: AcpRpcDisplayField[] = [];
    const method =
        typeof parsed.method === "string" && parsed.method.length > 0 ? parsed.method : undefined;
    const usedKeys = new Set<string>();

    if ("jsonrpc" in parsed) {
        usedKeys.add("jsonrpc");
    }
    if ("id" in parsed) {
        usedKeys.add("id");
    }

    if (method !== undefined) {
        pushField(fields, "method", method);
        usedKeys.add("method");
    }

    if (method === "session/update" && isRecord(parsed.params)) {
        const { update, ...rest } = parsed.params;
        if (Object.keys(rest).length > 0) {
            pushField(fields, "params", rest);
        }
        if (isRecord(update)) {
            pushField(fields, "update", update);
        } else if (update !== undefined) {
            pushField(fields, "update", update);
        }
        usedKeys.add("params");
    } else {
        for (const key of RPC_FIELD_ORDER) {
            if (key === "jsonrpc" || key === "id" || key === "method") {
                continue;
            }
            if (key in parsed) {
                pushField(fields, key, parsed[key]);
                usedKeys.add(key);
            }
        }
    }

    for (const key of Object.keys(parsed)) {
        if (!usedKeys.has(key)) {
            pushField(fields, key, parsed[key]);
        }
    }

    return fields;
}

/** Splits RPC fields from one NDJSON-RPC payload for display. */
export function formatAcpRpcDisplay(line: string): AcpRpcDisplayMessage {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
        return { raw: "" };
    }
    try {
        const parsed: unknown = JSON.parse(trimmed);
        if (!isRecord(parsed)) {
            return { raw: trimmed };
        }

        const fields = buildRpcDisplayFields(parsed);
        const method =
            typeof parsed.method === "string" && parsed.method.length > 0
                ? parsed.method
                : undefined;
        const summary = acpRpcSummaryTitle(parsed, method);
        const display: AcpRpcDisplayMessage = { fields };

        if ("id" in parsed) {
            display.rpcId = scalarString(parsed.id);
        }

        if (summary !== undefined) {
            display.title = summary;
        }

        display.defaultCollapsed = true;

        if (fields.length > 0) {
            return display;
        }

        return { raw: prettyJsonBlock(parsed) };
    } catch {
        return { raw: trimmed };
    }
}

/** True when the NDJSON line is an `agent_thought_chunk` session update. */
export function isAgentThoughtChunkLine(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
        return false;
    }
    try {
        const parsed: unknown = JSON.parse(trimmed);
        if (!isRecord(parsed)) {
            return false;
        }
        if (parsed.method !== "session/update" || !isRecord(parsed.params)) {
            return false;
        }
        const update = parsed.params.update;
        return isRecord(update) && sessionUpdateKind(update) === "agent_thought_chunk";
    } catch {
        return false;
    }
}

/** Short text preview from one thought chunk (for nested row labels). */
export function acpThoughtChunkPreview(line: string): string | undefined {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    try {
        const parsed: unknown = JSON.parse(trimmed);
        if (!isRecord(parsed) || !isRecord(parsed.params)) {
            return undefined;
        }
        const update = parsed.params.update;
        if (!isRecord(update) || sessionUpdateKind(update) !== "agent_thought_chunk") {
            return undefined;
        }
        const preview = truncateRpcTitle(textFromAcpContent(update.content));
        return preview.length > 0 ? preview : undefined;
    } catch {
        return undefined;
    }
}

export type AcpRpcLogListItem =
    | { kind: "entry"; entry: AcpRpcLogEntry }
    | { kind: "thoughtGroup"; groupKey: string; entries: readonly AcpRpcLogEntry[] };

/**
 * Merges consecutive `agent_thought_chunk` rows into one collapsible group.
 * A lone thought chunk stays a single top-level entry.
 */
export function groupAcpRpcLogEntries(entries: readonly AcpRpcLogEntry[]): AcpRpcLogListItem[] {
    const items: AcpRpcLogListItem[] = [];
    let thoughtRun: AcpRpcLogEntry[] = [];

    const flushThoughtRun = (): void => {
        if (thoughtRun.length === 0) {
            return;
        }
        if (thoughtRun.length === 1) {
            const entry = thoughtRun[0];
            if (entry !== undefined) {
                items.push({ kind: "entry", entry });
            }
        } else {
            const first = thoughtRun[0];
            if (first !== undefined) {
                items.push({
                    kind: "thoughtGroup",
                    groupKey: `thought-${first.id}`,
                    entries: thoughtRun,
                });
            }
        }
        thoughtRun = [];
    };

    for (const entry of entries) {
        if (isAgentThoughtChunkLine(entry.raw)) {
            thoughtRun.push(entry);
            continue;
        }
        flushThoughtRun();
        items.push({ kind: "entry", entry });
    }
    flushThoughtRun();
    return items;
}

/** Pretty-prints one NDJSON-RPC payload for the in-chat ACP log view. */
export function prettyPrintAcpRpcJson(line: string): string {
    const display = formatAcpRpcDisplay(line);
    if (display.raw !== undefined) {
        return display.raw;
    }
    const blocks: string[] = [];
    if (display.title !== undefined) {
        blocks.push(`title: ${display.title}`);
    }
    if (display.rpcId !== undefined) {
        blocks.push(`id: ${display.rpcId}`);
    }
    for (const field of display.fields ?? []) {
        if (field.kind === "scalar") {
            blocks.push(`${field.label}: ${field.value}`);
        } else {
            blocks.push(`${field.label}:\n${field.value}`);
        }
    }
    return blocks.join("\n\n");
}
