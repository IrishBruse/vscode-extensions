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
