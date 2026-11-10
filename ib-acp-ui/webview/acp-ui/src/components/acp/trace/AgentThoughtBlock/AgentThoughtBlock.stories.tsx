import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactElement, useEffect, useLayoutEffect, useState } from "react";
import { AgentMarkdown } from "../AgentMarkdown/AgentMarkdown";
import { AgentThoughtBlock } from "./AgentThoughtBlock";

const longThought = [
  "First pass reads the session file and the reducer.",
  "Second pass checks how the previous thought closes.",
  "Third pass looks at the compact tool line.",
  "Fourth pass checks the markdown inside the thought.",
  "Fifth pass tightens the paragraph spacing.",
  "Newest thought line stays in view.",
].join("\n\n");

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

const thinkingLines = [
  "Looking at the session file.",
  "The reducer still has this thought open.",
  "The timer should keep counting.",
  "The preview stays on the newest lines.",
  "Opening the heading shows the whole thought.",
];

function ThinkingThought(): ReactElement {
  const [startedAtMs] = useState(() => Date.now());
  const [count, setCount] = useState(1);
  useEffect(() => {
    if (count >= thinkingLines.length) {
      return;
    }
    const handle = window.setTimeout(() => {
      setCount((current) => current + 1);
    }, 900);
    return () => {
      window.clearTimeout(handle);
    };
  }, [count]);
  return (
    <AgentThoughtBlock
      text={thinkingLines.slice(0, count).join("\n\n")}
      startedAtMs={startedAtMs}
    />
  );
}

export const Thinking: Story = {
  render: () => <ThinkingThought />,
  args: {
    text: thinkingLines[0]!,
    startedAtMs: 0,
  },
};

export const Long: Story = {
  render: () => (
    <div>
      <AgentThoughtBlock text={longThought} durationMs={1_700} />
      <AgentMarkdown text="The reply below still uses the primary body text." />
    </div>
  ),
  args: {
    text: longThought,
    durationMs: 1_700,
  },
};

export const Collapsed: Story = {
  render: () => <CollapsedThought />,
  args: {
    text: "First pass looks at the session file.",
    durationMs: 12_400,
  },
};
