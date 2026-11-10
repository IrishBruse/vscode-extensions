import type { Meta, StoryObj } from "@storybook/react-vite";
import { ShellCommandHighlight } from "./ShellCommandHighlight";

const meta = {
  title: "ACP/Shell/ShellCommandHighlight",
  component: ShellCommandHighlight,
} satisfies Meta<typeof ShellCommandHighlight>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GitStatus: Story = {
  args: {
    command: "git status",
  },
};

export const PipeAndHead: Story = {
  args: {
    command: "rg -n visibleTraceTail ib-acp-ui | head",
  },
};

export const RedirectAndChain: Story = {
  args: {
    command: "npm test 2>&1 && echo done",
  },
};

export const QuotedPath: Story = {
  args: {
    command: 'cd "/home/econn/git/vscode-extensions" && ls -la',
  },
};

export const Comment: Story = {
  args: {
    command: "vp -C ib-acp-ui run test # quick check",
  },
};
