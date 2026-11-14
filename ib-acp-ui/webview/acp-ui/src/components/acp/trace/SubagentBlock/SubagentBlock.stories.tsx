import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactElement } from "react";
import type { TraceItem, TraceToolItem } from "../../../../chatReducer";
import { SubagentFocus } from "../SubagentFocus/SubagentFocus";
import { SubagentBlock } from "./SubagentBlock";
import { subagentStatusLabel } from "./subagentStatus";

const prompt = [
  "Find the session history loader.",
  "Note when the cache is shown.",
  "Note when the overlay is shown.",
  "List the files you read.",
  "Stop after the loader component.",
].join("\n");

const completedItem: TraceToolItem = {
  type: "tool",
  toolCallId: "task-1",
  title: "Task: Explore session history",
  kind: "other",
  subtitle: "explore",
  status: "completed",
  content: prompt,
  diffRows: undefined,
  detailVisible: true,
  durationMs: 8_400,
};

const sessionItem = {
  type: "subagent" as const,
  sessionId: "child-1",
  title: "Explore",
  description: "Find the login bug",
  state: "running" as const,
  stopReason: null,
};

const childTrace: TraceItem[] = [{ type: "agent", text: "Looking through the auth handler." }];

const meta = {
  title: "ACP/Trace/SubagentBlock",
  component: SubagentBlock,
} satisfies Meta<typeof SubagentBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Completed: Story = {
  args: {
    tool: completedItem,
  },
};

function RunningTask(): ReactElement {
  const [startedAtMs] = useState(() => Date.now());
  return (
    <SubagentBlock
      tool={{ ...completedItem, status: "in_progress", durationMs: undefined, startedAtMs }}
      activity={childTrace}
    />
  );
}

export const Running: Story = {
  args: { tool: completedItem },
  render: () => <RunningTask />,
};

function RunningSession(): ReactElement {
  const [startedAtMs] = useState(() => Date.now());
  return <SubagentBlock session={{ ...sessionItem, startedAtMs }} />;
}

export const Session: Story = {
  args: { session: sessionItem },
  render: () => <RunningSession />,
};

function OpenableSubagent(): ReactElement {
  const [open, setOpen] = useState(false);
  const [startedAtMs] = useState(() => Date.now());
  const liveItem = { ...sessionItem, startedAtMs };
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
    <SubagentBlock
      session={liveItem}
      onOpen={() => {
        setOpen(true);
      }}
    />
  );
}

export const OpenAndBack: Story = {
  args: { session: sessionItem },
  render: () => <OpenableSubagent />,
};
