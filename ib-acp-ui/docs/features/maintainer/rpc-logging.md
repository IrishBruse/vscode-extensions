# RPC logging

## User facing

For debugging ACP protocol traffic, open the **ACP** tab in an ACP UI chat (next to **Chat** and **Debug**).
Traffic is pretty-printed JSON, one NDJSON RPC message per row, with direction (`toAgent` or `fromAgent`) and agent name metadata.

**Show ACP Protocol in Chat** from the command palette focuses the active session and switches to the **ACP** tab.

The **ACP UI** output channel is for general extension messages only, not raw RPC traffic.

This is a developer diagnostics surface.
End users typically only need it when troubleshooting agent connectivity.

## Implementation

### In-chat ACP tab

[WebviewAcpRpcNdjsonSink](../../../src/extension/webviewAcpRpcNdjsonSink.ts) forwards complete NDJSON lines from [AcpUiSessionController](../../../src/extension/acpUiSessionController.ts) to the webview as `acpRpcLine` host messages.
[AcpRpcLogView](../../../webview/acp-ui/src/components/acp/protocol/AcpRpcLogView.tsx) renders them with [prettyPrintAcpRpcJson](../../../src/protocol/acpRpcLog.ts).

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
