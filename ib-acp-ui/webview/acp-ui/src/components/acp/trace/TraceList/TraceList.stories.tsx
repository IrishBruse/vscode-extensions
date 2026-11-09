import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRef } from "react";
import type { TraceItem } from "../../../../chatReducer";
import { TraceList } from "./TraceList";

const noop = () => undefined;

const meta = {
  title: "ACP/Trace/TraceList",
  component: TraceList,
} satisfies Meta<typeof TraceList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const UserAndAgentText: Story = {
  args: {
    items: [
      { type: "user", text: "Hello from the user." },
      { type: "agent", text: "Hello from the agent." },
    ],
    showThoughts: false,
    expandAllToolOutputs: false,
    followBottom: true,
    historyCommit: 0,
    traceScrollRef: createRef<HTMLElement>(),
    onCollapseExpandAll: noop,
    onOpenWorkspacePath: noop,
    onOpenImage: noop,
  },
};

const traceShell = {
  showThoughts: true,
  expandAllToolOutputs: false,
  followBottom: true,
  historyCommit: 0,
  traceScrollRef: createRef<HTMLElement>(),
  onCollapseExpandAll: noop,
  onOpenWorkspacePath: noop,
  onOpenImage: noop,
};

export const ThoughtAndTool: Story = {
  args: {
    ...traceShell,
    items: [
      { type: "user", text: "Rename the session file." },
      { type: "thought", text: "The session id is in the controller.", durationMs: 900 },
      {
        type: "tool",
        toolCallId: "read-1",
        title: "Read File",
        kind: "read",
        subtitle: "src/extension/acpUiSessionController.ts",
        status: "completed",
        content: "export class AcpUiSessionController {}",
        diffRows: undefined,
        detailVisible: true,
      },
      { type: "agent", text: "The rename handler is `postRenameSession`." },
    ] satisfies TraceItem[],
  },
};

export const UserImage: Story = {
  args: {
    ...traceShell,
    showThoughts: false,
    items: [
      {
        type: "user",
        text: "What color is this?",
        imageCount: 1,
        images: [
          {
            mimeType: "image/png",
            data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          },
        ],
      },
      { type: "agent", text: "The image is a single pixel." },
    ],
  },
};
