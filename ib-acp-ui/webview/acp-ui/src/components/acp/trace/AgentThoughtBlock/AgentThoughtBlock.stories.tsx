import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactElement, useLayoutEffect, useState } from "react";
import { AgentThoughtBlock } from "./AgentThoughtBlock";

const meta = {
  title: "ACP/Trace/AgentThoughtBlock",
  component: AgentThoughtBlock,
} satisfies Meta<typeof AgentThoughtBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    text: "I'll scan the trace reducer for `tool-call` grouping rules, then align the compact block copy with the tests.",
    durationMs: 4_200,
  },
};

export const Markdown: Story = {
  args: {
    text: "## Plan\n\n1. Read the reducer.\n2. Check **thought collapse** rules.\n3. Run the trace tests.",
    durationMs: 8_100,
  },
};

function CollapsedThought(): ReactElement {
  const [collapseNonce, setCollapseNonce] = useState(0);
  useLayoutEffect(() => {
    setCollapseNonce(1);
  }, []);
  return (
    <AgentThoughtBlock
      text={
        "First pass looks at the session file.\nSecond pass checks the reducer.\nThird pass checks the compact text."
      }
      durationMs={12_400}
      collapseNonce={collapseNonce}
    />
  );
}

export const Collapsed: Story = {
  render: () => <CollapsedThought />,
  args: {
    text: "First pass looks at the session file.",
    durationMs: 12_400,
  },
};
