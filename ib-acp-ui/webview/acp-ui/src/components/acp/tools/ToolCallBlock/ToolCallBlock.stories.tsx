import type { Meta, StoryObj } from "@storybook/react-vite";
import type { TraceToolItem } from "../../../../chatReducer";
import { ToolCallBlock } from "./ToolCallBlock";

const completedItem: TraceToolItem = {
  type: "tool",
  toolCallId: "grep-1",
  title: "Grep",
  kind: "search",
  subtitle: "src/components",
  status: "completed",
  content: undefined,
  diffRows: undefined,
  detailVisible: false,
};

const meta = {
  title: "ACP/Tools/ToolCallBlock",
  component: ToolCallBlock,
} satisfies Meta<typeof ToolCallBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    item: completedItem,
    expandAllToolOutputs: false,
    onCollapseExpandAll: () => undefined,
  },
};

export const Diff: Story = {
  args: {
    item: {
      ...completedItem,
      toolCallId: "edit-1",
      title: "Write File",
      kind: "edit",
      subtitle: "src/extension.ts",
      detailVisible: true,
      diffRows: [
        { kind: "context", text: "export function activate(): void {" },
        { kind: "removed", text: '  window.showInformationMessage("ready");' },
        { kind: "added", text: '  window.showInformationMessage("ACP UI ready");' },
      ],
    },
    expandAllToolOutputs: true,
    onCollapseExpandAll: () => undefined,
  },
};

export const Failed: Story = {
  args: {
    item: {
      ...completedItem,
      status: "failed",
      content: "ENOENT: no such file or directory",
      detailVisible: true,
    },
    expandAllToolOutputs: false,
    onCollapseExpandAll: () => undefined,
  },
};

export const InProgress: Story = {
  args: {
    item: { ...completedItem, status: "in_progress", content: undefined, detailVisible: false },
    expandAllToolOutputs: false,
    onCollapseExpandAll: () => undefined,
  },
};
