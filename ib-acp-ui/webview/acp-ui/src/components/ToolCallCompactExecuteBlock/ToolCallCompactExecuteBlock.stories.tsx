import type { Meta, StoryObj } from "@storybook/react-vite";
import type { TraceToolItem } from "../../chatReducer";
import { ToolCallCompactExecuteBlock } from "./ToolCallCompactExecuteBlock";

const lines = Array.from({ length: 24 }, (_, i) => `log line ${i + 1}`);
lines[23] = "✓ built in 132ms";

const executeItem: TraceToolItem = {
  type: "tool",
  toolCallId: "run-1",
  title: "Terminal",
  kind: "execute",
  subtitle: "npm run build:webview",
  status: "completed",
  content: `$ npm run build:webview\n${lines.join("\n")}`,
  diffRows: undefined,
  detailVisible: true,
  durationMs: 132,
};

const meta = {
  title: "ACP UI/ToolCallCompactExecuteBlock",
  component: ToolCallCompactExecuteBlock,
} satisfies Meta<typeof ToolCallCompactExecuteBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    item: executeItem,
    expandAllToolOutputs: false,
    onCollapseExpandAll: () => undefined,
  },
};
