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

export const LongPath: Story = {
  args: {
    items: [
      {
        ...readItem,
        toolCallId: "read-settings",
        subtitle: "/home/econn/git/dotfiles/home/.config/Cursor/User/settings.json",
        content: undefined,
      },
    ],
    onOpenWorkspacePath: () => undefined,
  },
};

export const Default: Story = {
  args: {
    items: [readItem],
    onOpenWorkspacePath: () => undefined,
  },
};

export const Diff: Story = {
  args: {
    items: [
      {
        ...readItem,
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
    ],
    expandAllToolOutputs: true,
    onOpenWorkspacePath: () => undefined,
  },
};

export const Grouped: Story = {
  args: {
    items: [
      readItem,
      {
        ...readItem,
        toolCallId: "read-2",
        subtitle: "src/extension/acpUiSessionController.ts",
      },
    ],
    onOpenWorkspacePath: () => undefined,
  },
};
