# Cursor Extensions

## User facing

A subagent shows as one card.
The task row and the child session are that same card.
Opening the card shows that subagent.
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
`cursor/ask_question` shows one question per page with arrow-key selection, a typed Other answer, and no submit buttons.
Basic `cursor/create_plan` dialogs already work.
The plan dialog covers the chat.
Open plan writes that plan to `plan.md` and opens it in the editor.
Accept switches the session to agent mode and sends a follow-up that implements the plan.
Reject and Cancel leave the session in the current mode.
A Cursor todo update shows a TODO list in the chat.
That list uses the same marks as an agent plan.
A later update refreshes the same list.

Planned: richer UI for the remaining Cursor extension methods.
Goals include phased plan dialogs and inline generated images.

## Implementation

[handleExtensionMethod](../../../src/acp/session/acpSessionBridge.ts#L347-L479) routes `cursor/*` ext methods.
[CursorAskQuestionDialog](../../../webview/acp-ui/src/components/acp/dialogs/CursorAskQuestionDialog/CursorAskQuestionDialog.tsx) handles ask-question flows.
[CursorCreatePlanDialog](../../../webview/acp-ui/src/components/acp/dialogs/CursorCreatePlanDialog/CursorCreatePlanDialog.tsx#L7-L56) covers the chat and keeps Open plan at the bottom left.
[openPlanMarkdownInEditor](../../../src/platform/openPlanMarkdown.ts#L17-L34) writes that plan to `plan.md` and opens it in the editor.
[implementPlanPrompt](../../../src/acp/session/implementPlan.ts#L23-L35) is the follow-up sent after Accept, once the session mode is agent.

[taskToolFieldsFromRaw](../../../src/acp/mapping/taskToolPresentation.ts#L34-L63) reads a Cursor task `rawInput` (`_toolName: "task"`, prompt, description, subagent type).
[sessionUpdateToWebviewMessages](../../../src/acp/mapping/sessionUpdateMapping.ts#L1163-L1190) stores the subagent type as the subtitle and the prompt as the tool content.
A background result (`isBackground` or status `disconnected`) stays in progress.
[session_message](../../../src/acp/mapping/sessionUpdateMapping.ts#L1349-L1351) and `session_message_chunk` append their text on the session that owns the message.
[withSessionLinks](../../../src/acp/mapping/sessionUpdateMapping.ts#L1402-L1426) links a tool to each `session` content block.
[cursorSubagentUpdateMessage](../../../src/acp/mapping/sessionUpdateMapping.ts#L1560-L1637) links the child session to that task.
[childStateUpdateMessage](../../../src/acp/mapping/sessionUpdateMapping.ts#L1656-L1679) applies a child `state_update`.
[messagesForSessionNotification](../../../src/acp/mapping/sessionUpdateMapping.ts#L1691-L1728) keeps a nested child on its parent session.
[SubagentBlock](../../../webview/acp-ui/src/components/acp/trace/SubagentBlock/SubagentBlock.tsx#L164-L213) renders that card, including a transcript that still has the older raw JSON subtitle.
[upsertCursorTask](../../../webview/acp-ui/src/chatReducer.ts#L1603-L1650) updates that same tool row when `cursor/task` arrives, keeps a running task running, and stores `agentId`.
[finishCursorTask](../../../webview/acp-ui/src/chatReducer.ts#L1652-L1686) drops the extra child row when that task owns the session.
[applySubagentUpdate](../../../webview/acp-ui/src/chatReducer.ts#L2065-L2130) places a nested child inside its parent.
[markLiveSubagentsUnknown](../../../webview/acp-ui/src/chatReducer.ts#L2131-L2160) clears a confirmed running state after a disconnect.
[postSessionOrChild](../../../src/acp/session/acpSessionBridge.ts#L198-L209) keeps a child permission's tool row on that child.
[SubagentFocus](../../../webview/acp-ui/src/components/acp/trace/SubagentFocus/SubagentFocus.tsx#L11-L84) opens that card and renders the child's live transcript.

[cursorTodosFromExtensionParams](../../../src/acp/mapping/cursorTodoPresentation.ts#L108-L128) reads `cursor/update_todos`.
[postCursorUpdateTodos](../../../src/acp/session/acpSessionBridge.ts#L481-L492) posts that list from the extension request.
[cursorTodoToolMessages](../../../src/acp/mapping/sessionUpdateMapping.ts#L604-L627) drops the Update TODOs tool row.
[applyCursorUpdateTodos](../../../webview/acp-ui/src/chatReducer.ts#L1794-L1845) keeps one list and merges rows by id.
[PlanBlock](../../../webview/acp-ui/src/components/acp/trace/PlanBlock/PlanBlock.tsx#L57-L91) draws that list.

Gaps: `phases` on create_plan, inline `generate_image`, and agent `toolCallId` correlation in bridge request ids.

Task: [cursor-extension-ux](../../tasks/cursor-extension-ux.md).
Related features: [sessions](./sessions.md), [composer](./composer.md).
Reference: [cursor extensions](../../cursor-extensions/extensions.md).
