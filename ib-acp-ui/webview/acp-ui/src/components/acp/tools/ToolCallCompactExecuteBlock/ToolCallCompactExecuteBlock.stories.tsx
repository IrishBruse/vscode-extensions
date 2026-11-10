import type { Meta, StoryObj } from "@storybook/react-vite";
import type { TraceToolItem } from "../../../../chatReducer";
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
  title: "ACP/Tools/ToolCallCompactExecuteBlock",
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

export const Running: Story = {
  args: {
    item: { ...executeItem, status: "in_progress", content: "$ npm run build:webview\nbuilding…", durationMs: undefined },
    expandAllToolOutputs: false,
    onCollapseExpandAll: () => undefined,
  },
};

export const Failed: Story = {
  args: {
    item: {
      ...executeItem,
      status: "failed",
      content: "exit 1\nFAIL src/chatReducer.test.ts",
      subtitle: "npm test",
    },
    expandAllToolOutputs: false,
    onCollapseExpandAll: () => undefined,
  },
};

export const BashPipe: Story = {
  args: {
    item: {
      ...executeItem,
      toolCallId: "bash-pipe",
      subtitle: "rg -n visibleTraceTail ib-acp-ui | head",
      content:
        "ib-acp-ui/webview/acp-ui/src/visibleTraceTail.ts:12:export function visibleTraceTail",
      durationMs: 48,
    },
    expandAllToolOutputs: false,
    onCollapseExpandAll: () => undefined,
  },
};

export const BashChained: Story = {
  args: {
    item: {
      ...executeItem,
      toolCallId: "bash-chain",
      subtitle: 'npm run build:webview 2>&1 && echo "ok"',
      content: "✓ built in 132ms\nok",
      durationMs: 210,
    },
    expandAllToolOutputs: false,
    onCollapseExpandAll: () => undefined,
  },
};

export const BashSuccessWithoutExitZero: Story = {
  args: {
    item: {
      ...executeItem,
      toolCallId: "bash-success",
      subtitle: "npm test",
      content: "PASS src/chatReducer.test.ts\n",
      durationMs: 3_400,
    },
    expandAllToolOutputs: true,
    onCollapseExpandAll: () => undefined,
  },
};
