# Chat trace

## User facing

The chat trace is the scrolling conversation panel above the composer.
It shows your messages, streaming agent replies, reasoning thoughts, tool calls, file diffs, terminal output, and TODO lists.
While the panel follows new text, empty space equal to 10% of the panel height stays above the composer.
A thought block uses quieter text.
The open body shows three lines and stays on the newest text.
You can scroll that window to earlier lines while the text stays the same.
Click a thought heading to hide or show that block.
When a new thought block appears, the previous thought block closes.
It stays open if you have scrolled up and that block is on screen.

Your messages and agent replies render as theme-aware markdown with colored headings, GFM tables, and syntax-highlighted fenced code blocks.
A quote uses the markdown preview bar: theme quote background, a 5px border, and padding inside the bar.
An image on your message shows as a small thumbnail.
Click the thumbnail to view the image larger.
Transcript text uses the normal foreground color.
A run of thought blocks and tool calls has extra padding so the group stays separate from the reply.
Each code block has a copy button.

Tool calls appear as one line each while the agent works.
A file path on that line shows the path.
A read of `SKILL.md` shows `Used` and the folder that holds that file, for example `Used writing-for-agents`.
A long path keeps the end and starts with `...` so the label stays within 50 characters.
The path text uses the link color.
Hover uses the link hover color.
The full path appears in a tooltip after the pointer rests on the path.
A markdown file path on a tool line opens that file in the editor.
Click a tool line that has more text to show that text.
A write always shows its diff under the line.
A long diff shows a short window around the edits.
A bash command stays on the `$` line.
While that command runs, the line shows `Running for 3.8s` and the clock keeps counting.
Its output sits in a quote bar under that line.
A short result shows in that block.
A long result stays closed until you click Show output.

A TODO list shows the agent plan.
Each item has a mark for pending, in progress, complete, or cancelled.

A subagent task shows as its own card.
The card shows the status, the short description, the subagent type, and the prompt.
Open the card to read that subagent, then use Back to return to the parent chat.
A child session from the agent shows the same way, with status Running, Needs action, Idle, Failed, or Cancelled.
A long prompt starts collapsed.

While a session loads from the agent, a saved last screen is shown when one exists.
A loading indicator fills the panel only when that cache is empty.
Scrolling up to the top of the saved screen can show a loading overlay that does not change the transcript height.
Older history is applied in one step and the current scroll position is kept.

Adjust **Chat content width (%)** in settings to narrow the transcript and composer column (for example `50` centers a half-width column).

## Implementation

### Trace state and streaming

[chatReducer](../../../webview/acp-ui/src/chatReducer.ts#L541-L787) applies extension messages to trace state.
[createChatStateFromInit](../../../webview/acp-ui/src/chatReducer.ts#L209-L337) seeds the trace from the bootstrap payload.

ACP `session/update` events map in [sessionUpdateToWebviewMessages](../../../src/acp/mapping/sessionUpdateMapping.ts#L621-L810):

- `agent_message_chunk` to streaming agent text
- `agent_thought_chunk` to thought blocks
- `user_message_chunk` to user text (including load replay)
- `tool_call` and `tool_call_update` to tool trace items
- `plan` to plan blocks

Edit tools with ACP `diff` content get line-level `diffRows` and the trace always shows that diff.
Cursor multi-line `toolCallId` values are normalized to the first line so pending and completed updates land on the same row.
Permission requests that carry edit diffs also update that row before you approve.

[joinThoughtChunks](../../../webview/acp-ui/src/chatReducer.ts) concatenates consecutive thought chunks without inserting spaces.
Client-measured thought and command durations (and other UI-only fields) are written to the `cache` array in the `.acp` session file.
After `session/load` replay, [mergeThoughtDurationsFromCache](../../../webview/acp-ui/src/chatReducer.ts#L307-L335) and [mergeToolDurationsFromCache](../../../webview/acp-ui/src/chatReducer.ts#L341-L372) copy those durations back onto the authoritative transcript.

### Trace rendering

[TraceList](../../../webview/acp-ui/src/components/acp/trace/TraceList/TraceList.tsx#L101-L373) walks trace items and picks a presentation by type.

- User and agent text: [AgentMarkdown](../../../webview/acp-ui/src/components/acp/trace/AgentMarkdown/AgentMarkdown.tsx#L117-L158) with [remark-gfm](https://github.com/remarkjs/remark-gfm).
  Code highlighting uses [renderHighlightedCode](../../../webview/acp-ui/src/components/acp/trace/AgentMarkdown/codeHighlighting.tsx#L101-L120) with workbench theme colors.
  [blockquote](../../../webview/acp-ui/src/components/acp/trace/AgentMarkdown/AgentMarkdown.css#L185-L192) uses the markdown preview quote bar.
- Thoughts: [AgentThoughtBlock](../../../webview/acp-ui/src/components/acp/trace/AgentThoughtBlock/AgentThoughtBlock.tsx#L31-L110) is a disclosure.
  The heading stays open until it is clicked.
  It says Thinking while the thought is running and Thought once it finishes, with the elapsed time when known.
  The body uses description text, `max-height: 3lh`, and sets `scrollTop` to `scrollHeight` when it opens and on each text change.
  [previousThoughtIndexToCollapse](../../../webview/acp-ui/src/components/acp/trace/TraceList/thoughtCollapse.ts#L12-L30) closes the previous thought when a new one appears.
  The close is skipped when the transcript is scrolled up and that row is on screen.
  [activityGroupRanges](../../../webview/acp-ui/src/components/acp/trace/TraceList/traceActivityGroup.ts#L10-L31) wraps each run of thoughts and tool calls.
  [trace-activity-group](../../../webview/acp-ui/src/components/acp/trace/TraceList/TraceList.css#L91-L96) adds padding around that run.
- TODO lists: [PlanBlock](../../../webview/acp-ui/src/components/acp/trace/PlanBlock/PlanBlock.tsx#L57-L91) draws a mark for pending, in progress, complete, and cancelled.
- Subagent tasks: [SubagentTaskBlock](../../../webview/acp-ui/src/components/acp/tools/SubagentTaskBlock/SubagentTaskBlock.tsx#L39-L124) shows status and an Open control.
  [SubagentSessionBlock](../../../webview/acp-ui/src/components/acp/trace/SubagentSessionBlock/SubagentSessionBlock.tsx#L10-L38) shows an ACP child session on the parent chat.
  [SubagentFocus](../../../webview/acp-ui/src/components/acp/trace/SubagentFocus/SubagentFocus.tsx#L10-L68) and [TaskFocus](../../../webview/acp-ui/src/components/acp/trace/SubagentFocus/TaskFocus.tsx#L12-L40) show that subagent, and Back returns to the parent.
  [messagesForSessionNotification](../../../src/acp/mapping/sessionUpdateMapping.ts#L1044-L1062) keeps child session updates on that child.
  [partitionTraceSegments](../../../webview/acp-ui/src/components/acp/trace/TraceList/TraceList.tsx#L55-L77) keeps each task on its own row.
- Tools: [ToolCallCompactBlock](../../../webview/acp-ui/src/components/acp/tools/ToolCallCompactBlock/ToolCallCompactBlock.tsx#L339-L405).
  [toolCallDetailKind](../../../webview/acp-ui/src/toolCallCompactText.ts) shows a write as a diff, makes ranged reads with extra text clickable, and leaves whole-file reads as one line.
  [formatCompactPath](../../../webview/acp-ui/src/toolCallCompactText.ts) shows paths under the agent working directory (`init.workspaceRoot`) as relative paths, including when the agent writes them with `~`.
  Other paths shorten to `~/…`.
  [truncatePathLabel](../../../webview/acp-ui/src/toolCallCompactText.ts) keeps the end of a path and prefixes `...` when the label would pass 50 characters.
  [skillFolderName](../../../webview/acp-ui/src/toolCallCompactText.ts#L187-L201) names the folder that holds `SKILL.md`.
  [compactToolDetailParts](../../../webview/acp-ui/src/toolCallCompactText.ts#L423-L438) then shows that read as `Used` plus that folder, and the folder still opens the file.
  [CompactPathLink](../../../webview/acp-ui/src/components/acp/tools/ToolCallCompactBlock/ToolCallCompactBlock.tsx#L48-L168) shows that label and the full path in a workbench-style tooltip.
  The path uses `--vscode-textLink-foreground`.
  Hover and focus use `--vscode-textLink-activeForeground`.
  A markdown `file://` path is decoded by [filesystemPathFromFileUri](../../../src/platform/fileUriPath.ts#L6-L28) and opened with the default text editor by [openWorkspacePathTarget](../../../src/platform/openWorkspacePathTarget.ts#L13-L21), including a plan file outside the workspace.
  Execute output uses [ToolCallCompactExecuteBlock](../../../webview/acp-ui/src/components/acp/tools/ToolCallCompactExecuteBlock/ToolCallCompactExecuteBlock.tsx#L34-L118).
  The command stays on the `$` line.
  [BashRunTimer](../../../webview/acp-ui/src/components/acp/tools/ToolCallCompactExecuteBlock/ToolCallCompactExecuteBlock.tsx#L15-L28) counts while the command runs.
  [runningBashStartedAtMs](../../../webview/acp-ui/src/chatReducer.ts#L261-L272) feeds the same clock to the composer.
  [executeOutputPreview](../../../webview/acp-ui/src/toolCallCompactText.ts#L647-L676) keeps a long result closed.
  Show output opens that result in the quote bar from [tool-call-compact-execute-output](../../../webview/acp-ui/src/components/acp/tools/ToolCallCompactExecuteBlock/ToolCallCompactExecuteBlock.css#L54-L66).
  Command lines show a compact duration when known (`$ ls 117ms`).
  Summaries come from [toolCallCompactText.ts](../../../webview/acp-ui/src/toolCallCompactText.ts).

[createChatStateFromInit](../../../webview/acp-ui/src/chatReducer.ts#L274-L301) seeds the trace from `init.visibleTrace`.
While that cache is on screen and history is loading, transcript updates go to a side buffer in [chatReducer](../../../webview/acp-ui/src/chatReducer.ts#L631-L634).
When loading ends, the buffer replaces the visible trace in one step ([sessionHistoryLoading](../../../webview/acp-ui/src/chatReducer.ts#L767-L791)).
[anchoredScrollTop](../../../webview/acp-ui/src/anchoredScroll.ts#L1-L15) keeps the same pixels in view if you have scrolled up.
[agent-trace-follow-gap](../../../webview/acp-ui/src/AcpUiApp.css#L46-L49) is 10% of the transcript height, so follow-scroll stops above the composer.
[visibleTraceTail](../../../webview/acp-ui/src/visibleTraceTail.ts#L12-L53) chooses the rows that fill the scrollport.
The webview writes them to the session file `cache` when [visibleTraceCacheEpoch](../../../webview/acp-ui/src/chatReducer.ts) bumps at turn end, not on every stream update.
[SessionHistoryLoader](../../../webview/acp-ui/src/components/acp/trace/SessionHistoryLoader/SessionHistoryLoader.tsx#L7-L26) fills the panel only when the cache is empty.
A zero-height overlay is used at the top of a cached screen when you scroll up during load.

### Content width setting

[readContentWidthRatioFromSettings](../../../src/acp/config/contentWidthRatioSetting.ts#L17-L22) reads `ib-acp-ui.contentWidthPercent` as a 0.1 to 1 ratio.
[AcpUiApp](../../../webview/acp-ui/src/AcpUiApp.tsx#L142-L143) applies it via the `--acp-ui-content-width-ratio` CSS variable.

### Markdown theme sync

[resolveMarkdownThemeVariables](../../../src/platform/vscode/resolveMarkdownThemeVariables.ts) resolves workbench colors and token rules for the webview.
[acpUiSessionController](../../../src/extension/acpUiSessionController.ts#L107-L109) reposts theme variables when the color theme changes.
[installAgentMarkdownThemeColors](../../../webview/acp-ui/src/agentMarkdownTheme.ts#L63-L86) applies CSS variables in the webview.
