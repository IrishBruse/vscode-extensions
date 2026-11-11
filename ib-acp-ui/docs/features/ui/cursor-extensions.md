# Cursor Extensions

## User facing

Subagent tasks show as cards with the status, the short description, the subagent type, and the prompt.
Open a card to read that subagent, then use Back to return to the parent chat.
`cursor/ask_question` and basic `cursor/create_plan` dialogs already work.

Planned: richer UI for the remaining Cursor extension methods.
Goals include phased plan dialogs, a dedicated todo panel, and inline generated images.

## Implementation

[handleExtensionMethod](../../../src/acp/session/acpSessionBridge.ts#L218-L297) routes `cursor/*` ext methods.
[CursorAskQuestionDialog](../../../webview/acp-ui/src/components/acp/dialogs/CursorAskQuestionDialog/CursorAskQuestionDialog.tsx) handles ask-question flows.
[CursorCreatePlanDialog](../../../webview/acp-ui/src/components/acp/dialogs/CursorCreatePlanDialog/CursorCreatePlanDialog.tsx) handles basic create-plan acceptance.

[taskToolFieldsFromRaw](../../../src/acp/mapping/taskToolPresentation.ts#L34-L63) reads a Cursor task `rawInput` (`_toolName: "task"`, prompt, description, subagent type).
[sessionUpdateToWebviewMessages](../../../src/acp/mapping/sessionUpdateMapping.ts#L824-L880) stores the subagent type as the subtitle and the prompt as the tool content, and keeps a later completion from replacing that prompt with the duration JSON.
[SubagentTaskBlock](../../../webview/acp-ui/src/components/acp/tools/SubagentTaskBlock/SubagentTaskBlock.tsx#L39-L124) renders that card, including a transcript that still has the older raw JSON subtitle.
[upsertCursorTask](../../../webview/acp-ui/src/chatReducer.ts#L1036-L1088) updates that same tool row when `cursor/task` arrives.
[TaskFocus](../../../webview/acp-ui/src/components/acp/trace/SubagentFocus/TaskFocus.tsx#L12-L40) opens that card.

Gaps: `phases` on create_plan, dedicated UI for `update_todos`, inline `generate_image`, and agent `toolCallId` correlation in bridge request ids.

Task: [cursor-extension-ux](../../tasks/cursor-extension-ux.md).
Related features: [sessions](./sessions.md), [composer](./composer.md).
Reference: [cursor extensions](../../cursor-extensions/extensions.md).
