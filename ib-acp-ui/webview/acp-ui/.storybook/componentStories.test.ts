import { describe, expect, it } from "vite-plus/test";

const STORY_MODULES = [
  "../src/components/AgentMarkdown/AgentMarkdown.stories.tsx",
  "../src/components/AgentThoughtBlock/AgentThoughtBlock.stories.tsx",
  "../src/components/ChatComposer/ChatComposer.stories.tsx",
  "../src/components/ChatHeader/ChatHeader.stories.tsx",
  "../src/components/ConfigOptionControls/ConfigOptionControls.stories.tsx",
  "../src/components/CursorAskQuestionDialog/CursorAskQuestionDialog.stories.tsx",
  "../src/components/CursorCreatePlanDialog/CursorCreatePlanDialog.stories.tsx",
  "../src/components/EmptyChatState/EmptyChatState.stories.tsx",
  "../src/components/ImageViewer/ImageViewer.stories.tsx",
  "../src/components/ModelConfigPopover/ModelConfigPopover.stories.tsx",
  "../src/components/PermissionDialog/PermissionDialog.stories.tsx",
  "../src/components/PlanBlock/PlanBlock.stories.tsx",
  "../src/components/SessionHistoryLoader/SessionHistoryLoader.stories.tsx",
  "../src/components/SessionModeIndicator/SessionModeIndicator.stories.tsx",
  "../src/components/ToolCallBlock/ToolCallBlock.stories.tsx",
  "../src/components/ToolCallCompactBlock/ToolCallCompactBlock.stories.tsx",
  "../src/components/ToolCallCompactExecuteBlock/ToolCallCompactExecuteBlock.stories.tsx",
  "../src/components/TraceList/TraceList.stories.tsx",
  "../src/components/VsDropdown/VsDropdown.stories.tsx",
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
