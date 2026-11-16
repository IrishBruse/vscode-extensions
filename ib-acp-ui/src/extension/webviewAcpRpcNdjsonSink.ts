import type { AcpRpcNdjsonLineContext, AcpRpcNdjsonSink } from "../acp/ports/rpcNdjsonSink";

export type WebviewAcpRpcNdjsonSinkHandler = (
    line: string,
    context?: AcpRpcNdjsonLineContext,
) => void;

/** Forwards raw NDJSON-RPC lines to the open session webview. */
export class WebviewAcpRpcNdjsonSink implements AcpRpcNdjsonSink {
    readonly isLoggingEnabled = true;

    constructor(private readonly onLine: WebviewAcpRpcNdjsonSinkHandler) {}

    appendRawNdjsonLine(line: string, context?: AcpRpcNdjsonLineContext): void {
        this.onLine(line, context);
    }
}
