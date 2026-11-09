import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentThoughtBlock } from "./AgentThoughtBlock";

const meta = {
  title: "ACP UI/AgentThoughtBlock",
  component: AgentThoughtBlock,
} satisfies Meta<typeof AgentThoughtBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    text: "I'll scan the trace reducer for tool-call grouping rules, then align the compact block copy with the tests.",
    durationMs: 4_200,
  },
};
