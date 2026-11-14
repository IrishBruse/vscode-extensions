# Cursor Extensions

## User facing

A subagent shows as one card.
The card shows the status, the short description, and the subagent type.
A background subagent stays Running until it finishes.
A running card shows a live timer in the same form as Thinking, such as `Running for 1.2s`.
Unknown work, and a lost connection, show as Unknown.
The latest lines of work show on the card.
Open the card to read the prompt and the full transcript.
Back returns to the parent chat.
`cursor/task` `agentId` attaches that child session to the task.
A linked child does not add a second row.
Cursor streams that child only after `initialize` includes `_meta.subagents`.
`cursor/ask_question` and basic `cursor/create_plan` dialogs already work.
The plan dialog covers the chat.
Open plan writes that plan to `plan.md` and opens it in the editor.

Planned: richer UI for the remaining Cursor extension methods.
Goals include phased plan dialogs, a dedicated todo panel, and inline generated images.

## Implementation

[handleExtensionMethod](../../../src/acp/session/acpSessionBridge.ts#L264-L387) routes `cursor/*` ext methods.
[CursorAskQuestionDialog](../../../webview/acp-ui/src/components/acp/dialogs/CursorAskQuestionDialog/CursorAskQuestionDialog.tsx) handles ask-question flows.
[CursorCreatePlanDialog](../../../webview/acp-ui/src/components/acp/dialogs/CursorCreatePlanDialog/CursorCreatePlanDialog.tsx#L7-L56) covers the chat and keeps Open plan at the bottom left.
[openPlanMarkdownInEditor](../../../src/platform/openPlanMarkdown.ts#L17-L34) writes that plan to `plan.md` and opens it in the editor.

[taskToolFieldsFromRaw](../../../src/acp/mapping/taskToolPresentation.ts#L34-L63) reads a Cursor task `rawInput` (`_toolName: "task"`, prompt, description, subagent type).
[sessionUpdateToWebviewMessages](../../../src/acp/mapping/sessionUpdateMapping.ts#L1085-L1119) stores the subagent type as the subtitle and the prompt as the tool content.
A background result (`isBackground` or status `disconnected`) stays in progress.
[session_message](../../../src/acp/mapping/sessionUpdateMapping.ts#L1270-L1272) and `session_message_chunk` append their text on the session that owns the message.
[withSessionLinks](../../../src/acp/mapping/sessionUpdateMapping.ts#L1323-L1334) links a tool to each `session` content block.
[cursorSubagentUpdateMessage](../../../src/acp/mapping/sessionUpdateMapping.ts#L1408-L1482) links the child session to that task.
[childStateUpdateMessage](../../../src/acp/mapping/sessionUpdateMapping.ts#L1506-L1527) applies a child `state_update`.
[messagesForSessionNotification](../../../src/acp/mapping/sessionUpdateMapping.ts#L1529-L1566) keeps a nested child on its parent session.
[SubagentBlock](../../../webview/acp-ui/src/components/acp/trace/SubagentBlock/SubagentBlock.tsx#L164-L213) renders that card, including a transcript that still has the older raw JSON subtitle.
[upsertCursorTask](../../../webview/acp-ui/src/chatReducer.ts#L1395-L1442) updates that same tool row when `cursor/task` arrives, keeps a running task running, and stores `agentId`.
[finishCursorTask](../../../webview/acp-ui/src/chatReducer.ts#L1444-L1465) drops the extra child row when that task owns the session.
[applySubagentUpdate](../../../webview/acp-ui/src/chatReducer.ts#L1722-L1784) places a nested child inside its parent.
[markLiveSubagentsUnknown](../../../webview/acp-ui/src/chatReducer.ts#L1787-L1816) clears a confirmed running state after a disconnect.
[postSessionOrChild](../../../src/acp/session/acpSessionBridge.ts#L169-L180) keeps a child permission's tool row on that child.
[SubagentFocus](../../../webview/acp-ui/src/components/acp/trace/SubagentFocus/SubagentFocus.tsx#L11-L84) opens that card and renders the child's live transcript.

Gaps: `phases` on create_plan, dedicated UI for `update_todos`, inline `generate_image`, and agent `toolCallId` correlation in bridge request ids.

Task: [cursor-extension-ux](../../tasks/cursor-extension-ux.md).
Related features: [sessions](./sessions.md), [composer](./composer.md).
Reference: [cursor extensions](../../cursor-extensions/extensions.md).
