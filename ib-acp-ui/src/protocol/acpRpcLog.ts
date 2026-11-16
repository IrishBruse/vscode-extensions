import type { AcpRpcNdjsonDirection } from "../acp/ports/rpcNdjsonSink";

export const maxAcpRpcLogLines = 500;

export type AcpRpcLogEntry = {
    id: number;
    direction: AcpRpcNdjsonDirection;
    agentName?: string;
    raw: string;
};

/** Pretty-prints one NDJSON-RPC payload for the in-chat ACP log view. */
export function prettyPrintAcpRpcJson(line: string): string {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
        return "";
    }
    try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
        return trimmed;
    }
}
