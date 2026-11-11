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
  const [startedAtMs] = useState(() => Date.now());
  const liveItem = { ...item, startedAtMs };
  if (open) {
    return (
      <SubagentFocus
        title={liveItem.title}
        status={subagentStatusLabel(liveItem.state, liveItem.stopReason)}
        startedAtMs={startedAtMs}
        description={liveItem.description}
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
      item={liveItem}
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

function RunningCard(): ReactElement {
  const [startedAtMs] = useState(() => Date.now());
  return <SubagentSessionBlock item={{ ...item, startedAtMs }} />;
}

export const Running: Story = {
  args: { item },
  render: () => <RunningCard />,
};

export const OpenAndBack: Story = {
  args: { item },
  render: () => <OpenableSubagent />,
};
