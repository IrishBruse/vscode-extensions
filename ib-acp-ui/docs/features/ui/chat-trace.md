# Chat trace

## User facing

The chat trace is the scrolling conversation panel above the composer.
It shows your messages, streaming agent replies, reasoning thoughts, tool calls, file diffs, terminal output, and structured agent plans.
While the panel follows new text, empty space equal to 10% of the panel height stays above the composer.
Click a thought heading to hide or show that block.
When a new thought block appears, the previous thought block closes.
It stays open if you have scrolled up and that block is on screen.

Your messages and agent replies render as theme-aware markdown with colored headings, GFM tables, and syntax-highlighted fenced code blocks.
An image on your message shows as a small thumbnail.
Click the thumbnail to view the image larger.
Transcript text uses the normal foreground color.
A run of thought blocks and tool calls has extra padding so the group stays separate from the reply.
Each code block has a copy button.

Tool calls appear as one line each while the agent works.
A file name on that line stays the file name.
The full path appears in a tooltip after the pointer rests on the name.
Click a tool line that has more text to show that text.
A write always shows its diff under the line.
A long diff starts with the first lines and an Expand control.

A subagent task shows as its own card.
The card shows the short description, the subagent type, and the prompt.
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

[joinThoughtChunks](../../../webview/acp-ui/src/chatReducer.ts#L555-L573) merges consecutive thought chunks.
Client-measured thought and command durations (and other UI-only fields) are written to the sibling `.jsonl` beside the `.acp` session file.
After `session/load` replay, [mergeThoughtDurationsFromCache](../../../webview/acp-ui/src/chatReducer.ts#L307-L335) and [mergeToolDurationsFromCache](../../../webview/acp-ui/src/chatReducer.ts#L341-L372) copy those durations back onto the authoritative transcript.

### Trace rendering

[TraceList](../../../webview/acp-ui/src/components/acp/trace/TraceList/TraceList.tsx#L101-L373) walks trace items and picks a presentation by type.

- User and agent text: [AgentMarkdown](../../../webview/acp-ui/src/components/acp/trace/AgentMarkdown/AgentMarkdown.tsx#L117-L158) with [remark-gfm](https://github.com/remarkjs/remark-gfm).
  Code highlighting uses [renderHighlightedCode](../../../webview/acp-ui/src/components/acp/trace/AgentMarkdown/codeHighlighting.tsx#L101-L120) with workbench theme colors.
- Thoughts: [AgentThoughtBlock](../../../webview/acp-ui/src/components/acp/trace/AgentThoughtBlock/AgentThoughtBlock.tsx#L17-L62) is a disclosure.
  The heading stays open until it is clicked and shows a duration when known (`Thought for 1.2s`).
  [previousThoughtIndexToCollapse](../../../webview/acp-ui/src/components/acp/trace/TraceList/thoughtCollapse.ts#L12-L30) closes the previous thought when a new one appears.
  The close is skipped when the transcript is scrolled up and that row is on screen.
  [activityGroupRanges](../../../webview/acp-ui/src/components/acp/trace/TraceList/traceActivityGroup.ts#L10-L31) wraps each run of thoughts and tool calls.
  [trace-activity-group](../../../webview/acp-ui/src/components/acp/trace/TraceList/TraceList.css#L91-L96) adds padding around that run.
- Plans: [PlanBlock](../../../webview/acp-ui/src/components/acp/trace/PlanBlock/PlanBlock.tsx#L8-L40).
- Subagent tasks: [SubagentTaskBlock](../../../webview/acp-ui/src/components/acp/tools/SubagentTaskBlock/SubagentTaskBlock.tsx#L38-L113).
  [partitionTraceSegments](../../../webview/acp-ui/src/components/acp/trace/TraceList/TraceList.tsx#L45-L67) keeps each task on its own row.
- Tools: [ToolCallCompactBlock](../../../webview/acp-ui/src/components/acp/tools/ToolCallCompactBlock/ToolCallCompactBlock.tsx#L339-L405).
  [toolCallDetailKind](../../../webview/acp-ui/src/toolCallCompactText.ts#L482-L493) shows a write as a diff and makes other tools with extra text clickable.
  [CompactPathLink](../../../webview/acp-ui/src/components/acp/tools/ToolCallCompactBlock/ToolCallCompactBlock.tsx#L33-L152) shows the file name and the full path in a workbench-style tooltip.
  Execute output uses [ToolCallCompactExecuteBlock](../../../webview/acp-ui/src/components/acp/tools/ToolCallCompactExecuteBlock/ToolCallCompactExecuteBlock.tsx).
  Command lines show a compact duration when known (`$ ls 117ms`).
  Summaries come from [toolCallCompactText.ts](../../../webview/acp-ui/src/toolCallCompactText.ts).

[createChatStateFromInit](../../../webview/acp-ui/src/chatReducer.ts#L274-L301) seeds the trace from `init.visibleTrace`.
While that cache is on screen and history is loading, transcript updates go to a side buffer in [chatReducer](../../../webview/acp-ui/src/chatReducer.ts#L631-L634).
When loading ends, the buffer replaces the visible trace in one step ([sessionHistoryLoading](../../../webview/acp-ui/src/chatReducer.ts#L767-L791)).
[anchoredScrollTop](../../../webview/acp-ui/src/anchoredScroll.ts#L1-L15) keeps the same pixels in view if you have scrolled up.
[agent-trace-follow-gap](../../../webview/acp-ui/src/AcpUiApp.css#L46-L49) is 10% of the transcript height, so follow-scroll stops above the composer.
[visibleTraceTail](../../../webview/acp-ui/src/visibleTraceTail.ts#L12-L53) chooses the rows that fill the scrollport and the webview writes them beside the session file.
[SessionHistoryLoader](../../../webview/acp-ui/src/components/acp/trace/SessionHistoryLoader/SessionHistoryLoader.tsx#L7-L26) fills the panel only when the cache is empty.
A zero-height overlay is used at the top of a cached screen when you scroll up during load.

### Content width setting

[readContentWidthRatioFromSettings](../../../src/acp/config/contentWidthRatioSetting.ts#L17-L22) reads `ib-acp-ui.contentWidthPercent` as a 0.1 to 1 ratio.
[AcpUiApp](../../../webview/acp-ui/src/AcpUiApp.tsx#L142-L143) applies it via the `--acp-ui-content-width-ratio` CSS variable.

### Markdown theme sync

[resolveMarkdownThemeVariables](../../../src/platform/vscode/resolveMarkdownThemeVariables.ts) resolves workbench colors and token rules for the webview.
[acpUiSessionController](../../../src/extension/acpUiSessionController.ts#L107-L109) reposts theme variables when the color theme changes.
[installAgentMarkdownThemeColors](../../../webview/acp-ui/src/agentMarkdownTheme.ts#L63-L86) applies CSS variables in the webview.
