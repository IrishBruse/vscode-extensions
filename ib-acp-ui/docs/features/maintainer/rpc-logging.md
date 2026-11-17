# RPC logging

## User facing

For debugging ACP protocol traffic, open the **ACP** tab in an ACP UI chat (next to **Chat** and **Debug**).
Traffic is pretty-printed JSON, one NDJSON RPC message per row, with direction (`toAgent` or `fromAgent`) and agent name metadata.

The same session also appends every wire line to `chats/<sessionId>.rpc.ndjson` beside the `.acp` file.
Click the path at the top of the **ACP** tab to copy it to the clipboard.

**Show ACP Protocol in Chat** from the command palette focuses the active session and switches to the **ACP** tab.

The **ACP UI** output channel is for general extension messages only, not raw RPC traffic.

This is a developer diagnostics surface.
End users typically only need it when troubleshooting agent connectivity.

## Implementation

### In-chat ACP tab

[AcpUiSessionController](../../../src/extension/acpUiSessionController.ts) composes [FileAcpRpcNdjsonSink](../../../src/platform/node/fileRpcNdjsonSink.ts) (per-session `chats/<sessionId>.rpc.ndjson`) with [WebviewAcpRpcNdjsonSink](../../../src/extension/webviewAcpRpcNdjsonSink.ts), which forwards complete NDJSON lines to the webview as `acpRpcLine` host messages.
The init payload includes `acpRpcLogPath` for the copy control in [AcpRpcLogView](../../../webview/acp-ui/src/components/acp/protocol/AcpRpcLogView.tsx).
[AcpRpcLogView](../../../webview/acp-ui/src/components/acp/protocol/AcpRpcLogView.tsx) renders each line with [formatAcpRpcDisplay](../../../src/protocol/acpRpcLog.ts).
The entry head shows the JSON-RPC **method** (or **response** / **error**) and starts collapsed.
The body lists each top-level RPC field except **jsonrpc** (**method**, **params**, **result**, **error**, plus any extras) in composer-style labels with syntax-highlighted JSON.
The JSON-RPC **id** appears as a number in the entry head.
`session/update` still peels **update** out of **params** for readability.
Consecutive `agent_thought_chunk` lines collapse into one group; expand it to inspect each chunk.

[activateAcpUiExtension](../../../src/extension/activateAcpUiExtension.ts#L23-L46) registers `ib-acp-ui.showAcpRpcLog`, which calls [showAcpRpcLogInActiveSession](../../../src/extension/acpUiCustomEditorProvider.ts) to post `focusTraceView` with `acp`.
The global activation sink is [NullAcpRpcNdjsonSink](../../../src/acp/ports/rpcNdjsonSink.ts) so stdio taps do not duplicate RPC into the output channel.

### Stdio tap

When logging is enabled, [createNdjsonRpcLogTap](../../../src/acp/infrastructure/acpAgentProcess.ts#L27-L63) wraps agent stdin and stdout.
This happens inside [AcpAgentProcess.start](../../../src/acp/infrastructure/acpAgentProcess.ts).
Complete NDJSON lines are forwarded to the sink without altering the wire protocol.

[formatAcpRpcNdjsonDebugLine](../../../src/acp/ports/rpcNdjsonSink.ts#L19-L38) formats each record.

### File sink

Outside VS Code, [FileAcpRpcNdjsonSink](../../../src/platform/node/fileRpcNdjsonSink.ts) writes to a file controlled by `ACP_RPC_LOG`.

### Composite and null sinks

[CompositeAcpRpcNdjsonSink](../../../src/acp/ports/rpcNdjsonSink.ts#L50) fans out to multiple sinks.
[NullAcpRpcNdjsonSink](../../../src/acp/ports/rpcNdjsonSink.ts#L41) disables logging when `isLoggingEnabled` is false.
