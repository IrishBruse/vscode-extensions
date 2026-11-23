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
A reconnect while the chat is open replays into a side buffer, then swaps that transcript in.
The message you just sent stays at the end of that transcript.
Agent system notifications are not shown as your messages.
A thought keeps the time it took on that full transcript.
A bash command keeps its elapsed time on that full transcript.

**Debug** in the chat replaces the transcript with a run view of that same conversation.

The agent can send a chat title after you send a message.
That title replaces `New Cursor chat` in the composer and on the editor tab.
ACP UI stores that title in the `.acp` file.
A later save of that file keeps the agent title.

The chat UI will also react to more agent-driven updates such as mode changes, config option updates, title sync, and usage meters.
User message chunks during `session/load` replay already appear in the trace.

## Implementation

### Resume (`session/load`)

The UI session id (`.acp` header UUID) is separate from the runtime session id (`header.runtimeSessionId`) used for ACP `session/load`.

[shouldLoadRuntimeSession](../../../src/acp/session/acpSessionBridge.test.ts) decides load vs new on connect.
[supportsLoadSession](../../../src/acp/infrastructure/acpAgentProcess.ts#L259-L261) reads `loadSession` from agent capabilities.
[loadSession](../../../src/acp/infrastructure/acpAgentProcess.ts#L298-L311) calls the SDK with cwd and `mcpServers` (today empty).

[loadSessionWithAuthRetry](../../../src/acp/session/acpSessionBridge.ts#L1050-L1063) handles auth-required errors during load.
Replay `session/update` events map through [sessionUpdateMapping.ts](../../../src/acp/mapping/sessionUpdateMapping.ts).
That includes `user_message_chunk` to user text in the trace.
[user_message_chunk](../../../src/acp/mapping/sessionUpdateMapping.ts#L1137-L1144) drops a chunk that contains `<system_notification>`.
A load that starts while the chat is open buffers replay, then [sessionHistoryLoading](../../../webview/acp-ui/src/chatReducer.ts#L2502-L2563) swaps that transcript in and keeps the message just sent ([traceWithPendingUserEcho](../../../webview/acp-ui/src/chatReducer.ts#L949-L961)).

[acpUiSessionController.ts](../../../src/extension/acpUiSessionController.ts) passes `runtimeSessionId` on connect and clears it on chat reset.
[acpUiSessionsStore.ts](../../../src/extension/acpUiSessionsStore.ts) persists the runtime id in the session header.

Protocol: [session setup](../../acp/protocol/v1/session-setup.mdx).

### Local persistence

ACP UI uses client-owned session files (`acpUi/session/1` schema) for session metadata, composer user-message history, the viewport transcript, and the last model configuration.

[acpUiSessionJsonl.ts](../../../src/extension/acpUiSessionJsonl.ts) handles read and write.
[resolveSessionsDirectoryUri](../../../src/extension/acpUiSessionJsonl.ts#L56-L75) honors `ib-acp-ui.sessionsDirectory` when set.
See [editor-shell](../ui/editor-shell.md).
[acpUiSessionController.ts](../../../src/extension/acpUiSessionController.ts) passes composer `history` in the `init` bootstrap payload.
[deleteSessionFile](../../../src/extension/acpUiSessionJsonl.ts) removes the `<uuid>.acp` file.

Allow always and Reject always choices are `permissionGrants` on the session document.
Reopening the chat restores them.
Resetting the chat or switching clients clears them.
The last model id and config values are `modelConfig` on the session document.
Reopening the chat seeds the composer from that snapshot and applies it again after the agent connects.
Resetting the chat or switching clients clears it.
The last on-screen transcript, including UI-only fields such as thought and tool `durationMs`, is the `cache` array on the session document.
`thoughtDurations` on that document stores one client-measured thought time per thought, in order.
`bashDurations` stores each bash elapsed time with its tool call id.
[writeSessionCache](../../../src/extension/acpUiSessionJsonl.ts#L152-L185) stores the screen and both time lists.
[readSessionCache](../../../src/extension/acpUiSessionJsonl.ts#L87-L90) sends the screen on `init`, and the controller sends both time lists with it.
There is no sibling `.jsonl` file and no `acpUi/visibleTrace` schema.
When `session/load` succeeds, agent replay is authoritative for the transcript text.
The webview keeps the cached screen until replay finishes, then swaps the full transcript in without moving the scroll position.
[applyThoughtDurationList](../../../webview/acp-ui/src/chatReducer.ts#L585-L613) copies `thoughtDurations` onto the replayed thoughts from the start.
[mergeThoughtDurationsFromCache](../../../webview/acp-ui/src/chatReducer.ts#L509-L578) copies a time from `cache` onto the replayed thought with the same text.
[applyBashDurations](../../../webview/acp-ui/src/chatReducer.ts#L688-L709) copies `bashDurations` onto the replayed commands by tool call id.
[mergeToolDurationsFromCache](../../../webview/acp-ui/src/chatReducer.ts#L619-L649) copies command durations by `toolCallId` and keeps a saved bash time over a shorter replay clock.
On load failure, the bridge falls back to `session/new` and the cached screen stays if replay produced no items (composer history still comes from `init.history`).

### Debug view

[buildChatDebug](../../../webview/acp-ui/src/chatDebugModel.ts#L255-L355) turns the live trace into the chat and its subagents.
[ChatDebugView](../../../webview/acp-ui/src/components/acp/debug/ChatDebugView.tsx#L66-L144) shows those steps in the chat when Debug is selected.

### Session updates

[sessionUpdateMapping.ts](../../../src/acp/mapping/sessionUpdateMapping.ts) maps `session/update` notifications to webview messages.
`user_message_chunk` maps to append user text (shipped).
`config_option_update` maps to `sessionConfigOptions` and syncs bridge cache via [syncConfigOptionsFromAgent](../../../src/acp/session/acpSessionBridge.ts).

Still no-op in the default branch: `current_mode_update`.
`usage_update` feeds the composer context usage label.
`session_info_update` updates the session title via a bridge hook, not the trace.
[applySessionInfoUpdate](../../../src/extension/acpUiSessionController.ts#L439-L456) writes that title into the `.acp` file as soon as it arrives.
[shouldPublishSessionFileTitle](../../../src/extension/sessionTitleFromPrompt.ts#L18-L23) ignores a later file save that still has `New Cursor chat`.
[titleAfterSessionFileReload](../../../src/extension/sessionTitleFromPrompt.ts#L28-L40) keeps the same title when the session index reloads the file before that write finishes.
Cursor supplies the generated title this way; ACP UI does not copy the first prompt for Cursor chats.
Other agents may take the first prompt as a fallback title only after the turn when no `session_info_update` arrives.

Task: [session-update-handlers](../../tasks/session-update-handlers.md).
Protocol: [session modes](../../acp/protocol/v1/session-modes.mdx), [session config options](../../acp/protocol/v1/session-config-options.mdx).
See also [prompt turn](../../acp/protocol/v1/prompt-turn.mdx).
