import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRef } from "react";
import { TraceList } from "./TraceList";

const noop = () => undefined;

const meta = {
  title: "ACP UI/TraceList",
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
    toolCallVerbosity: "verbose",
    followBottom: true,
    historyCommit: 0,
    traceScrollRef: createRef<HTMLElement>(),
    onCollapseExpandAll: noop,
    onOpenWorkspacePath: noop,
    onOpenImage: noop,
  },
};
