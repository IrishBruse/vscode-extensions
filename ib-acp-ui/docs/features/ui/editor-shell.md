# Editor shell

## User facing

ACP UI lives in VS Code as a custom editor for `*.acp` session files, an activity bar container, and a **Setup** tree view.

Open **ACP UI** from the activity bar to focus setup.
Create a chat from the Setup view **+**, from the `.acp` editor tab **New Chat** split control (`+ ▾`), or use **Open ACP UI**.
`Ctrl+T` / `Cmd+T` opens a new chat when the Setup view or an ACP UI editor tab is focused.

Each chat opens as an editor tab with the ACP UI webview.
Switching away from a chat tab and back keeps the scroll position.
The chat does not jump or go blank while the webview has no size.
Each chat is one `<uuid>.acp` file.
The tab name is the chat title stored in that file.
The editor title **…** menu includes switching between the visual UI and the raw JSONL text editor.

The Setup sidebar configures ACP clients, shows runtime choices that live outside VS Code settings, and reviews the chat open in the editor.
Those rows sit on one level.

Configure where session files are stored with `ib-acp-ui.sessionsDirectory`.
Empty uses extension global storage.
Absolute paths and workspace-relative paths are supported.

## Implementation

### Extension activation

[activate](../../../src/extension.ts#L16-L29) wires RPC logging, session store init, the Setup tree, custom editor registration, and panel commands.
The manifest starts the extension with `onStartupFinished` in [package.json](../../../package.json#L349-L351); commands, the Setup view, and `.acp` editors reuse the activation events VS Code generates from those contributions.

### Custom editor

[acpUiCustomEditorViewType](../../../src/extension/acpUiCustomEditorProvider.ts#L20) is `ibAcpUi.session`.
[AcpUiCustomEditorProvider.resolveCustomTextEditor](../../../src/extension/acpUiCustomEditorProvider.ts#L70-L80) hosts the webview and creates an [AcpUiSessionController](../../../src/extension/acpUiSessionController.ts#L66) per document.

[getAcpUiWebviewHtml](../../../src/extension/acpUiWebviewShell.ts#L11-L43) paints the connecting state in HTML and loads `main.js` as a module.
[webviewLayoutIsMeasurable](../../../webview/acp-ui/src/webviewLayout.ts#L3-L14) ignores a hidden or zero-size webview.
The transcript keeps its width and scroll position until the tab is on screen again.
[publishSessionTitle](../../../src/extension/acpUiSessionController.ts#L351-L362) reads the title from the `.acp` header and applies it to the editor tab and the composer.
The chat UI and the markdown renderer load as later chunks from `media/acp-ui/chunks/`.

### Setup tree view

[AcpUiSessionsViewProvider](../../../src/extension/acpUiSessionsView.ts#L136-L199) implements the tree data provider for `acpUiSessionsView`.
[buildAcpUiSetupTree](../../../src/extension/acpUiSetupTree.ts#L211-L260) builds the Clients, Runtime, and Open chat rows on one level.

### Commands and keybindings

[registerAcpUiPanel](../../../src/extension/acpUiPanel.ts#L105-L129) registers open and new-chat commands declared in `package.json`.

### Session file layout

[ACP_UI_SESSION_SCHEMA](../../../src/extension/acpUiSessionJsonlFormat.ts#L4) is `acpUi/session/1`.
[resolveSessionsDirectoryUri](../../../src/extension/acpUiSessionJsonl.ts#L56-L75) resolves the configured or default storage directory.
[sessionFileUriForId](../../../src/extension/acpUiSessionJsonl.ts#L78-L80) stores each chat as `<uuid>.acp`.
The chat title stays in the file header.
[ensureSessionFileNamedById](../../../src/extension/acpUiSessionJsonl.ts#L189-L208) moves an older folder path to that file name.

Related: [sessions](../acp/sessions.md), [agents](./agents.md).
