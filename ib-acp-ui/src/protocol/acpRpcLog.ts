import type { AcpRpcNdjsonDirection } from "../acp/ports/rpcNdjsonSink";

export const maxAcpRpcLogLines = 500;

export type AcpRpcLogEntry = {
    id: number;
    direction: AcpRpcNdjsonDirection;
    agentName?: string;
    raw: string;
};

/** Structured fields extracted from one NDJSON-RPC line for the in-chat ACP log. */
export type AcpRpcDisplayMessage = {
    method?: string;
    params?: string;
    result?: string;
    error?: string;
    raw?: string;
};

function prettyJsonBlock(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Splits method/params/result from one NDJSON-RPC payload for display. */
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

        const display: AcpRpcDisplayMessage = {};

        if (typeof parsed.method === "string" && parsed.method.length > 0) {
            display.method = parsed.method;
        }
        if (parsed.params !== undefined) {
            display.params = prettyJsonBlock(parsed.params);
        }
        if (parsed.result !== undefined) {
            display.result = prettyJsonBlock(parsed.result);
        }
        if (parsed.error !== undefined) {
            display.error = prettyJsonBlock(parsed.error);
        }

        if (
            display.method !== undefined ||
            display.params !== undefined ||
            display.result !== undefined ||
            display.error !== undefined
        ) {
            return display;
        }

        return { raw: prettyJsonBlock(parsed) };
    } catch {
        return { raw: trimmed };
    }
}

/** Pretty-prints one NDJSON-RPC payload for the in-chat ACP log view. */
export function prettyPrintAcpRpcJson(line: string): string {
    const display = formatAcpRpcDisplay(line);
    if (display.raw !== undefined) {
        return display.raw;
    }
    const blocks: string[] = [];
    if (display.method !== undefined) {
        blocks.push(`method: ${display.method}`);
    }
    if (display.params !== undefined) {
        blocks.push(`params:\n${display.params}`);
    }
    if (display.result !== undefined) {
        blocks.push(`result:\n${display.result}`);
    }
    if (display.error !== undefined) {
        blocks.push(`error:\n${display.error}`);
    }
    return blocks.join("\n\n");
}
