import { describe, expect, it } from "vite-plus/test";

const STORY_MODULES = [
  "../src/components/acp/trace/AgentMarkdown/AgentMarkdown.stories.tsx",
  "../src/components/acp/trace/AgentThoughtBlock/AgentThoughtBlock.stories.tsx",
  "../src/components/acp/composer/ChatComposer/ChatComposer.stories.tsx",
  "../src/components/acp/debug/ChatDebugView.stories.tsx",
  "../src/components/acp/session/ChatHeader/ChatHeader.stories.tsx",
  "../src/components/acp/composer/ConfigOptionControls/ConfigOptionControls.stories.tsx",
  "../src/components/acp/dialogs/CursorAskQuestionDialog/CursorAskQuestionDialog.stories.tsx",
  "../src/components/acp/dialogs/CursorCreatePlanDialog/CursorCreatePlanDialog.stories.tsx",
  "../src/components/acp/session/EmptyChatState/EmptyChatState.stories.tsx",
  "../src/components/acp/dialogs/ImageViewer/ImageViewer.stories.tsx",
  "../src/components/acp/composer/ModelConfigPopover/ModelConfigPopover.stories.tsx",
  "../src/components/acp/dialogs/PermissionDialog/PermissionDialog.stories.tsx",
  "../src/components/acp/trace/PlanBlock/PlanBlock.stories.tsx",
  "../src/components/acp/trace/SessionHistoryLoader/SessionHistoryLoader.stories.tsx",
  "../src/components/acp/composer/SessionModeIndicator/SessionModeIndicator.stories.tsx",
  "../src/components/acp/tools/ToolCallBlock/ToolCallBlock.stories.tsx",
  "../src/components/acp/tools/ToolCallCompactBlock/ToolCallCompactBlock.stories.tsx",
  "../src/components/acp/trace/SubagentBlock/SubagentBlock.stories.tsx",
  "../src/components/acp/tools/ToolCallCompactExecuteBlock/ToolCallCompactExecuteBlock.stories.tsx",
  "../src/ShellCommandHighlight.stories.tsx",
  "../src/components/acp/trace/TraceList/TraceList.stories.tsx",
  "../src/components/vscode/Button/Button.stories.tsx",
  "../src/components/vscode/Checkbox/Checkbox.stories.tsx",
  "../src/components/vscode/Dropdown/Dropdown.stories.tsx",
  "../src/components/vscode/Input/Input.stories.tsx",
  "../src/components/scenarios/Scenarios.stories.tsx",
] as const;

type StoryFileModule = {
  default: { title?: string };
  [exportName: string]: unknown;
};

function namedStoryExports(module: StoryFileModule): string[] {
  return Object.keys(module).filter((key) => key !== "default");
}

describe("component story modules", () => {
  for (const storyPath of STORY_MODULES) {
    it(storyPath, async () => {
      const storyModule = (await import(storyPath)) as StoryFileModule;
      expect(typeof storyModule.default?.title).toBe("string");
      expect(storyModule.default.title?.trim().length).toBeGreaterThan(0);
      expect(namedStoryExports(storyModule).length).toBeGreaterThan(0);
    });
  }
});
