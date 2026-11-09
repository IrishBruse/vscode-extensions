import type { Meta, StoryObj } from "@storybook/react-vite";
import type { TraceToolItem } from "../../../../chatReducer";
import { ToolCallCompactBlock } from "./ToolCallCompactBlock";

const readItem: TraceToolItem = {
  type: "tool",
  toolCallId: "read-1",
  title: "Read File",
  kind: "read",
  subtitle: "webview/acp-ui/src/chatReducer.test.ts",
  status: "completed",
  content: "lines 218-267\nbody",
  diffRows: undefined,
  detailVisible: false,
};

const meta = {
  title: "ACP/Tools/ToolCallCompactBlock",
  component: ToolCallCompactBlock,
} satisfies Meta<typeof ToolCallCompactBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [readItem],
    onOpenWorkspacePath: () => undefined,
  },
};
