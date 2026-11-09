import type { Meta, StoryObj } from "@storybook/react-vite";
import { SessionHistoryLoader } from "./SessionHistoryLoader";

const meta = {
  title: "ACP/Trace/SessionHistoryLoader",
  component: SessionHistoryLoader,
} satisfies Meta<typeof SessionHistoryLoader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Overlay: Story = {
  args: {
    overlay: true,
  },
};
