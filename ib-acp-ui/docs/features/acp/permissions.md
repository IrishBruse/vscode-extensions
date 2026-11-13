# Permissions

## User facing

When an agent needs approval before running a tool, ACP UI shows a permission dialog above the composer.
The dialog shows the agent title.
A file path in that title is a link.
Click the link to open the file.
The dialog also shows the file path or command when the agent sent it separately.
A file write also shows the line counts and a short diff when the agent included the change.
The dialog lists the options the agent provided.
Pick an option to continue, or dismiss to cancel.
Allow always is remembered for that tool kind for this chat.
A later request of the same kind is approved without asking again.
Requests that are already waiting for that kind are approved too.
Allow once still asks every time.
Resetting the chat or switching clients clears the remembered choice.
For file edits, the Write File row in the chat trace shows a small inline diff preview when the agent included the change in the permission request.

While a permission prompt is open, the composer is blocked so you cannot send another message until you respond.

## Implementation

### ACP callback

[AcpAgentProcess](../../../src/acp/infrastructure/acpAgentProcess.ts#L303-L304) registers `requestPermission` on the SDK client connection.
[AcpSessionBridge.queuePermissionRequest](../../../src/acp/session/acpSessionBridge.ts#L147-L166) assigns a request id, posts webview messages, and waits on a promise.

[handlePermissionResponse](../../../src/acp/session/acpSessionBridge.ts#L186-L221) resolves the waiter when the webview replies.
[resolveGrantedPendingRequests](../../../src/acp/session/acpSessionBridge.ts#L224-L236) applies Allow always or Reject always to other requests that are already waiting.
[stickyPermissionOutcome](../../../src/acp/session/permissionMemory.ts#L52-L69) answers a later request when the chat already stored Allow always or Reject always for that tool kind.
The grants are `permissionGrants` on the session document.
Dispose cancels all pending waiters.

### Webview dialog

[extensionMessagesForPermissionRequest](../../../src/acp/mapping/sessionUpdateMapping.ts#L191-L256) builds `permissionRequest` messages.
[permissionToolTitle](../../../src/acp/mapping/sessionUpdateMapping.ts#L150-L160) keeps the agent title, including a delete path.
[permissionSummary](../../../src/acp/mapping/sessionUpdateMapping.ts#L162-L189) keeps the line counts after the path.
The same message includes a short diff when the tool call has one.
When the permission `toolCall` includes content (for example a `diff`), it also posts `updateToolCall` with `diffRows` or text so the tool row can show a preview while you decide.
Execute-style tools still get a command subtitle when the shell line can be resolved.

[chatReducer](../../../webview/acp-ui/src/chatReducer.ts#L1776-L1787) stores `permissionPrompt` state.
[PermissionDialog](../../../webview/acp-ui/src/components/acp/dialogs/PermissionDialog/PermissionDialog.tsx#L43-L144) renders the title, the path, the summary, and the diff.
[permissionTitleParts](../../../webview/acp-ui/src/components/acp/dialogs/PermissionDialog/permissionTitle.ts#L14-L38) turns a backtick path into a link.

[AcpUiApp](../../../webview/acp-ui/src/AcpUiApp.tsx#L653-L675) wires button handlers to `postPermissionResponse` and opens a path link.
[acpUiSessionController](../../../src/extension/acpUiSessionController.ts#L772) forwards responses to the bridge.

Protocol: [tool calls](../../acp/protocol/v1/tool-calls.mdx).
