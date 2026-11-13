# Composer

## User facing

The chat composer is where you draft messages, run slash commands, mention workspace files, and (planned) attach multimodal content.
The top line shows the chat title from the `.acp` file on the left and `/ commands · @ files` on the right.
A title such as `New Cursor chat` leaves that spot on the workspace path.
The workspace path stays in the tooltip.
Context usage sits on that right side, before `/ commands · @ files`.
It shows used tokens and the context window, for example `13.3k/256.0k`.
Before the agent reports usage, that label shows a dash.
Connecting and Thinking sit in the center of that line and pulse while they are active.
A running bash command uses that same spot and shows `Running for 3.8s`.
ACP connection errors sit in that same spot.
A long error stays on one line, and the full text is in the tooltip.

While typing, ACP UI suggests completions without leaving the message box.
Type `/` to open slash-command suggestions from the connected agent alongside built-in commands such as `/clear`, `/new`, `/rename`, and `/show-thinking`.
Type `@` to mention workspace files.
Paths with spaces or quotes are inserted as quoted mentions.

Drag files from the Explorer or your file manager onto the chat to insert `@` path mentions.

Arrow Up recalls previous prompts from local session history when the caret is at the start of the first line.
That press keeps the text that was in the composer.
Arrow Down walks forward through recalled entries and then puts that text back.
If you edit a recalled prompt, Arrow Down on the last line puts that text back.
Ctrl+Z or Cmd+Z puts that text back at any time.
History is stored in the `.acp` session file (up to 55 entries) and restored on reopen.

Keyboard shortcuts while the composer is focused:

- Enter sends, Shift+Enter inserts a newline.
  While the agent is running, Enter adds the draft to the queue.
  Each later draft is added behind the ones already waiting.
  The queue sends one message at a time, in order, when the turn ends.
  Enter with an empty composer marks the next queued message as steering, so it sends after the current tool finishes and does not stop that tool.
  The next Enter interrupts the current message and sends that queued message now.
  The messages behind it stay in the queue.
  Each queued line has edit and remove.
- Shift+Tab cycles session mode when the agent exposes a mode option
- Ctrl+C / Cmd+C cancels the current turn when the agent is thinking, running a tool, or answering.
- Cancel does the same thing.
  It stays available for that whole turn.
- Ctrl+T / Cmd+T opens a new chat (when the Setup view or ACP UI editor is focused)

Planned: send images, audio, and structured file references in prompts when the agent advertises multimodal `promptCapabilities`.
Composer `@` file mentions will become structured ACP `resource` blocks instead of plain path text in the draft.
Today prompts are a single text block.

## Implementation

### Autocomplete

[buildComposerAutocompleteState](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerAutocomplete.ts) inspects the draft and caret.
It uses [queryFromCaret](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerAutocomplete.ts) to detect a `/query` or `@query` token.
Detection applies at the start of a line or after whitespace.

- **`/` mode** — filters [slashCommands](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerAutocomplete.ts).
  Builds items via [slashSuggestionItem](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerAutocomplete.ts).
  Groups with [groupSlashSuggestionItems](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerAutocomplete.ts).
- **`@` mode** — filters [workspaceFiles](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerAutocomplete.ts).
  Formats inserts with [formatPathMention](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerAutocomplete.ts).

[ChatComposer](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/ChatComposer.tsx) recomputes autocomplete from the draft (caret at end).
[AcpUiApp.onComposerKeyDown](../../../webview/acp-ui/src/AcpUiApp.tsx) handles keyboard navigation.

**Built-in commands** — [builtInSlashCommands](../../../webview/acp-ui/src/AcpUiApp.tsx) defines `/clear`, `/new`, `/rename`, `/show-thinking`.
**Agent commands** — ACP `available_commands_update` is mapped in [sessionUpdateMapping.ts](../../../src/acp/mapping/sessionUpdateMapping.ts).
[slashCommandMetadata.ts](../../../src/acp/slashCommandMetadata.ts) normalizes source labels and grouping.

[workspaceFiles](../../../webview/acp-ui/src/AcpUiApp.tsx) from the extension init payload.
Filtering is case-insensitive substring match, capped at 30 results.

Protocol: [available_commands_update](../../acp/protocol/v2/slash-commands.mdx).

### Status clock

[useComposerStatusText](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/ChatComposer.tsx#L126-L169) draws Connecting, Thinking, and Running in the center of the top line.
[runningBashStartedAtMs](../../../webview/acp-ui/src/chatReducer.ts#L261-L272) supplies the start time for a bash command that is still running.

### Context usage

[composerLocationLabel](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/ChatComposer.tsx#L175-L181) keeps the workspace path when the stored title is still `New Cursor chat`.
[ContextUsageLabel](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/ChatComposer.tsx#L183-L197) draws `13.3k/256.0k` on the composer top line.
[sessionUpdateToWebviewMessages](../../../src/acp/mapping/sessionUpdateMapping.ts#L1266-L1267) maps ACP `usage_update` (`used` of `size`) to `tokenUsage`.
When a turn ends with token counts and no context window has arrived, [prompt](../../../src/acp/session/acpSessionBridge.ts#L794-L801) sends that count so the label still shows a number.

### Prompt history

[updateSessionHistory](../../../src/extension/acpUiSessionJsonl.ts) persists composer history to the session JSONL file.
[maxUserMessageHistoryEntries](../../../src/extension/acpUiSessionJsonlFormat.ts#L16) caps history at 55 entries.

[recallOlderDraft](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerHistory.ts#L32-L67) keeps the current composer text when Arrow Up recalls history.
[recallNewerDraft](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerHistory.ts#L73-L94) walks forward and then puts that text back.
[undoToStashedDraft](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerHistory.ts#L115-L123) puts that text back on Ctrl+Z or Cmd+Z.
[AcpUiComposer](../../../webview/acp-ui/src/AcpUiComposer.tsx#L467-L515) handles those keys.
[shouldDeferJsonlHistoryReplay](../../../src/extension/acpUiSessionJsonlFormat.ts#L294) skips duplicate replay when agent load already restored user chunks.

Task: covered by [sessions](../acp/sessions.md).

### File drag and drop

[dataTransferLooksLikePathDrop](../../../webview/acp-ui/src/droppedFilePaths.ts#L8-L22) detects Explorer and OS file drops.
[collectPathsFromDataTransfer](../../../webview/acp-ui/src/droppedFilePaths.ts#L29-L60) resolves paths relative to the workspace root.
[appendFileMentionsToDraft](../../../webview/acp-ui/src/droppedFilePaths.ts#L180) inserts formatted `@` mentions.

[AcpUiApp](../../../webview/acp-ui/src/AcpUiApp.tsx) handles dragover and drop on the shell.

### Keyboard bindings

[shouldCycleSessionModeOnShiftTab](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerKeybindings.ts#L16-L30) gates Shift+Tab mode cycling.
[canCancelTurn](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerKeybindings.ts#L26-L32) keeps Cancel available while the agent is thinking, running a tool, or answering.
[shouldCancelRunOnCtrlC](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerKeybindings.ts#L34-L58) gates Ctrl+C cancel.
[shouldOpenNewChatOnCtrlT](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerKeybindings.ts#L1-L14) gates Ctrl+T new chat.
[resolveFollowUpEnter](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/composerFollowUp.ts#L21-L42) appends a draft to the queue, then steers or interrupts the next queued message.
[ChatComposer](../../../webview/acp-ui/src/components/acp/composer/ChatComposer/ChatComposer.tsx#L376-L418) shows each queued message on its own line.

### Multimodal prompts

Not implemented.
[prompt](../../../src/acp/infrastructure/acpAgentProcess.ts) assembles text-only content today.
Composer `@` mentions are handled as text inserts until structured resource blocks ship.

Task: [multimodal-prompts](../../tasks/multimodal-prompts.md).
Protocol: [prompt turn](../../acp/protocol/v1/prompt-turn.mdx).
