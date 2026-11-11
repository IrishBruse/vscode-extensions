import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlanBlock } from "./PlanBlock";

const meta = {
  title: "ACP/Trace/PlanBlock",
  component: PlanBlock,
} satisfies Meta<typeof PlanBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    entries: [
      { status: "in_progress", content: "Move trace blocks into dedicated folders" },
      { status: "pending", content: "Add Storybook stories for each block" },
    ],
  },
};

export const MixedStatuses: Story = {
  args: {
    entries: [
      { status: "completed", content: "Read the session controller", priority: "high" },
      { status: "in_progress", content: "Update the trace list", priority: "high" },
      { status: "pending", content: "Capture the README screenshots", priority: "low" },
      { status: "cancelled", content: "Skip the unused screenshot pass" },
    ],
  },
};
