# Editor shell

## User facing

ACP UI lives in VS Code as a custom editor for `*.acp` session files.

Create a chat from the `.acp` editor tab **New Chat** split control (`+ ▾`), or use **Open ACP UI**.
`Ctrl+T` / `Cmd+T` opens a new chat when an ACP UI editor tab is focused.

Each chat opens as an editor tab with the ACP UI webview.
Switching away from a chat tab and back keeps the scroll position.
The chat does not jump or go blank while the webview has no size.
Each chat is one `<uuid>.acp` file.
The tab name is the chat title stored in that file.
A background tab shows that title before you open it.
The editor title **…** menu includes switching between the visual UI and the raw JSONL text editor.

**Chat** and **Debug** float over the top of the transcript.
They do not take a row from the conversation.
Chat shows the conversation.
Debug replaces that transcript with a larger run view and hides the composer.
The call list fills the height of the debug view.
The run view shows the title, the latest request, and the turn and tool counts.
The line shows the chat and each subagent.
Each step has a circle that shows the share of its tool kinds.
The panel on the right lists those calls in the same colors.

Configure where session files are stored with `ib-acp-ui.sessionsDirectory`.
Empty uses extension global storage.
Absolute paths and workspace-relative paths are supported.

## Implementation

### Extension activation

[activate](../../../src/extension.ts#L16-L29) wires RPC logging, session store init, custom editor registration, and panel commands.
The manifest starts the extension with `onStartupFinished` in [package.json](../../../package.json#L285-L287); commands and `.acp` editors reuse the activation events VS Code generates from those contributions.

### Custom editor

[acpUiCustomEditorViewType](../../../src/extension/acpUiCustomEditorProvider.ts#L20) is `ibAcpUi.session`.
[AcpUiCustomEditorProvider.resolveCustomTextEditor](../../../src/extension/acpUiCustomEditorProvider.ts#L70-L80) hosts the webview and creates an [AcpUiSessionController](../../../src/extension/acpUiSessionController.ts#L66) per document.

[getAcpUiWebviewHtml](../../../src/extension/acpUiWebviewShell.ts#L11-L43) paints the connecting state in HTML and loads `main.js` as a module.
[webviewLayoutIsMeasurable](../../../webview/acp-ui/src/webviewLayout.ts#L3-L14) ignores a hidden or zero-size webview.
The transcript keeps its width and scroll position until the tab is on screen again.
[publishSessionTitle](../../../src/extension/acpUiSessionController.ts#L351-L362) reads the title from the `.acp` header and applies it to the editor tab and the composer.
[syncAcpUiBackgroundTabTitles](../../../src/extension/acpUiBackgroundTabTitles.ts#L57-L96) reads that same title for every open `.acp` tab.
[customLabelTemplate](../../../src/extension/acpUiEditorTabLabel.ts#L8-L14) stores it in `workbench.editor.customLabels.patterns` so the tab shows the title before the editor opens.
The chat UI and the markdown renderer load as later chunks from `media/acp-ui/chunks/`.

### Debug view

[AcpUiApp](../../../webview/acp-ui/src/AcpUiApp.tsx#L511-L532) switches the transcript between Chat and Debug.
The switch floats over the transcript, and Debug hides the composer.
[buildChatDebug](../../../webview/acp-ui/src/chatDebugModel.ts#L255-L353) puts the chat and each subagent on the line, and keeps the tools on that step.
[chatDebugShare](../../../webview/acp-ui/src/chatDebugModel.ts#L185-L194) counts the tool kinds for the share circle.
[ChatDebugView](../../../webview/acp-ui/src/components/acp/debug/ChatDebugView.tsx#L66-L144) draws that circle and lists the calls in a panel that fills the height of the view.

### Commands and keybindings

[registerAcpUiPanel](../../../src/extension/acpUiPanel.ts#L105-L129) registers open and new-chat commands declared in `package.json`.

### Session file layout

[ACP_UI_SESSION_SCHEMA](../../../src/extension/acpUiSessionJsonlFormat.ts#L4) is `acpUi/session/1`.
[resolveSessionsDirectoryUri](../../../src/extension/acpUiSessionJsonl.ts#L56-L75) resolves the configured or default storage directory.
[sessionFileUriForId](../../../src/extension/acpUiSessionJsonl.ts#L78-L80) stores each chat as `<uuid>.acp`.
The chat title stays in the file header.
[ensureSessionFileNamedById](../../../src/extension/acpUiSessionJsonl.ts#L189-L208) moves an older folder path to that file name.

Related: [sessions](../acp/sessions.md), [agents](./agents.md).
