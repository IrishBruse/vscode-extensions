import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlanBlock } from "./PlanBlock";

const meta = {
  title: "ACP UI/PlanBlock",
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
