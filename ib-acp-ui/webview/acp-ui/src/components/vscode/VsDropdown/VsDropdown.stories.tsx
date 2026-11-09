import type { Meta, StoryObj } from "@storybook/react-vite";
import { VsDropdown } from "./VsDropdown";

const meta = {
  title: "VS Code/VsDropdown",
  component: VsDropdown,
} satisfies Meta<typeof VsDropdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ThreeOptions: Story = {
  args: {
    ariaLabel: "Model",
    value: "sonnet",
    options: [
      { value: "opus", label: "Claude Opus" },
      { value: "sonnet", label: "Claude Sonnet" },
      { value: "haiku", label: "Claude Haiku" },
    ],
    onChange: () => undefined,
  },
};
