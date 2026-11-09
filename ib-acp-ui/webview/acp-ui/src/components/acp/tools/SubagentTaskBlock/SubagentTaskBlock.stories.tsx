import type { Meta, StoryObj } from "@storybook/react-vite";
import type { TraceToolItem } from "../../../../chatReducer";
import { SubagentTaskBlock } from "./SubagentTaskBlock";

const prompt = [
  "Find the session history loader.",
  "Note when the cache is shown.",
  "Note when the overlay is shown.",
  "List the files you read.",
  "Stop after the loader component.",
].join("\n");

const completedItem: TraceToolItem = {
  type: "tool",
  toolCallId: "task-1",
  title: "Task: Explore session history",
  kind: "other",
  subtitle: "explore",
  status: "completed",
  content: prompt,
  diffRows: undefined,
  detailVisible: true,
  durationMs: 8_400,
};

const meta = {
  title: "ACP/Tools/SubagentTaskBlock",
  component: SubagentTaskBlock,
} satisfies Meta<typeof SubagentTaskBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Completed: Story = {
  args: {
    item: completedItem,
    expandAllToolOutputs: false,
    onCollapseExpandAll: () => undefined,
  },
};

export const Running: Story = {
  args: {
    item: { ...completedItem, status: "in_progress", durationMs: undefined },
    expandAllToolOutputs: false,
    onCollapseExpandAll: () => undefined,
  },
};

export const Expanded: Story = {
  args: {
    item: completedItem,
    expandAllToolOutputs: true,
    onCollapseExpandAll: () => undefined,
  },
};
