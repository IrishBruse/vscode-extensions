import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactElement } from "react";
import type { TraceItem } from "../../../../chatReducer";
import { SubagentFocus } from "../SubagentFocus/SubagentFocus";
import { subagentStatusLabel } from "./subagentStatus";
import { SubagentSessionBlock } from "./SubagentSessionBlock";

const item = {
  type: "subagent" as const,
  sessionId: "child-1",
  title: "Explore",
  description: "Find the login bug",
  state: "running" as const,
  stopReason: null,
};

const childTrace: TraceItem[] = [{ type: "agent", text: "Looking through the auth handler." }];

function OpenableSubagent(): ReactElement {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <SubagentFocus
        title={item.title}
        status={subagentStatusLabel(item.state, item.stopReason)}
        description={item.description}
        items={childTrace}
        showThoughts
        expandAllToolOutputs={false}
        followBottom
        historyCommit={0}
        traceScrollRef={{ current: null }}
        onBack={() => {
          setOpen(false);
        }}
      />
    );
  }
  return (
    <SubagentSessionBlock
      item={item}
      onOpen={() => {
        setOpen(true);
      }}
    />
  );
}

const meta = {
  title: "ACP/Trace/SubagentSessionBlock",
  component: SubagentSessionBlock,
} satisfies Meta<typeof SubagentSessionBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Running: Story = {
  args: { item },
};

export const OpenAndBack: Story = {
  args: { item },
  render: () => <OpenableSubagent />,
};
