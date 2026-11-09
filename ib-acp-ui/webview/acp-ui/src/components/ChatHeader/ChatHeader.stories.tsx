import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatHeader } from "./ChatHeader";

const meta = {
  title: "ACP UI/ChatHeader",
  component: ChatHeader,
} satisfies Meta<typeof ChatHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    agentVersionLabel: "0.42.0",
    workspaceText: "/home/dev/myproject",
  },
};
