# Sessions

## User facing

ACP UI manages chat sessions end to end: creating chats, resuming conversations, persisting history locally, and reacting to agent-driven session updates.

When you reopen a chat, ACP UI restores the conversation when the agent supports `session/load` and the chat has a stored agent session id.
Agent-side context and replayed messages appear in the trace without starting a blank session.
If resume fails or the agent does not support load, ACP UI falls back to a new agent session.
Composer prompt history (Arrow-Up recall) is restored from the local `.acp` file when present.

Each chat is backed by a local session file that stores metadata, composer history, and the last screen of the transcript.
Closing and reopening the chat restores composer history and that screen from disk.
Reopening shows that screen immediately, instead of a conversation loader.
You can scroll inside that screen while the agent loads older messages.
When the older messages arrive, the screen you are looking at stays where it is.
The live transcript still comes from the agent via `session/load` replay when resume succeeds.

The sidebar is the setup pane for clients, runtime choices, and the chat open in the editor.

The chat UI will also react to more agent-driven updates such as mode changes, config option updates, title sync, and usage meters.
User message chunks during `session/load` replay already appear in the trace.

## Implementation

### Resume (`session/load`)

The UI session id (`.acp` header UUID) is separate from the runtime session id (`header.runtimeSessionId`) used for ACP `session/load`.

[shouldLoadRuntimeSession](../../../src/acp/session/acpSessionBridge.test.ts) decides load vs new on connect.
[supportsLoadSession](../../../src/acp/infrastructure/acpAgentProcess.ts#L259-L261) reads `loadSession` from agent capabilities.
[loadSession](../../../src/acp/infrastructure/acpAgentProcess.ts#L298-L311) calls the SDK with cwd and `mcpServers` (today empty).

[loadSessionWithAuthRetry](../../../src/acp/session/acpSessionBridge.ts#L914-L927) handles auth-required errors during load.
Replay `session/update` events map through [sessionUpdateMapping.ts](../../../src/acp/mapping/sessionUpdateMapping.ts).
That includes `user_message_chunk` to user text in the trace.

[acpUiSessionController.ts](../../../src/extension/acpUiSessionController.ts) passes `runtimeSessionId` on connect and clears it on chat reset.
[acpUiSessionsStore.ts](../../../src/extension/acpUiSessionsStore.ts) persists the runtime id in the session header.

Protocol: [session setup](../../acp/protocol/v1/session-setup.mdx).

### Local persistence

ACP UI uses client-owned session files (`acpUi/session/1` schema) for session metadata, composer user-message history, the viewport transcript, and the last model configuration.

[acpUiSessionJsonl.ts](../../../src/extension/acpUiSessionJsonl.ts) handles read and write.
[resolveSessionsDirectoryUri](../../../src/extension/acpUiSessionJsonl.ts#L54-L73) honors `ib-acp-ui.sessionsDirectory` when set.
See [editor-shell](../ui/editor-shell.md).
[acpUiSessionController.ts](../../../src/extension/acpUiSessionController.ts) passes composer `history` in the `init` bootstrap payload.
[deleteSessionFile](../../../src/extension/acpUiSessionJsonl.ts) removes the per-session folder (or a legacy flat file only).

The last model id and config values are `modelConfig` on the session document.
Reopening the chat seeds the composer from that snapshot and applies it again after the agent connects.
Resetting the chat or switching clients clears it.
The last on-screen transcript, including UI-only fields such as thought and tool `durationMs`, is the `cache` array on the session document.
[writeSessionCache](../../../src/extension/acpUiSessionJsonl.ts#L142-L153) stores that array, capped at the last screen.
[readSessionCache](../../../src/extension/acpUiSessionJsonl.ts#L102-L105) sends the items on `init`.
There is no sibling `.jsonl` file and no `acpUi/visibleTrace` schema.
When `session/load` succeeds, agent replay is authoritative for the transcript text.
The webview keeps the cached screen until replay finishes, then swaps the full transcript in without moving the scroll position.
[mergeThoughtDurationsFromCache](../../../webview/acp-ui/src/chatReducer.ts#L329-L370) copies thought durations from `cache` onto the replayed thoughts.
[mergeToolDurationsFromCache](../../../webview/acp-ui/src/chatReducer.ts#L376-L407) copies command durations by `toolCallId`.
On load failure, the bridge falls back to `session/new` and the cached screen stays if replay produced no items (composer history still comes from `init.history`).

### Setup sidebar

[buildAcpUiSetupTree](../../../src/extension/acpUiSetupTree.ts#L183-L244) builds Clients, Runtime, and Open chat.
[refresh](../../../src/extension/acpUiSessionsView.ts#L201-L214) fills that tree from merged clients and the active editor.
The open-chat rows read the active `.acp` tab through [getActiveAcpSessionUri](../../../src/extension/acpUiPanel.ts#L136-L159).

### Session updates

[sessionUpdateMapping.ts](../../../src/acp/mapping/sessionUpdateMapping.ts) maps `session/update` notifications to webview messages.
`user_message_chunk` maps to append user text (shipped).
`config_option_update` maps to `sessionConfigOptions` and syncs bridge cache via [syncConfigOptionsFromAgent](../../../src/acp/session/acpSessionBridge.ts).

Still no-op in the default branch: `current_mode_update` and `usage_update`.
`session_info_update` updates the session title via a bridge hook, not the trace.

Task: [session-update-handlers](../../tasks/session-update-handlers.md).
Protocol: [session modes](../../acp/protocol/v1/session-modes.mdx), [session config options](../../acp/protocol/v1/session-config-options.mdx).
See also [prompt turn](../../acp/protocol/v1/prompt-turn.mdx).
