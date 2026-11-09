import type { Meta, StoryObj } from "@storybook/react-vite";
import { VsDropdown } from "./VsDropdown";

const meta = {
  title: "VS Code/VsDropdown",
  component: VsDropdown,
} satisfies Meta<typeof VsDropdown>;

export default meta;

type Story = StoryObj<typeof meta>;

const modelOptions = [
  { value: "opus", label: "Claude Opus" },
  { value: "sonnet", label: "Claude Sonnet" },
  { value: "haiku", label: "Claude Haiku" },
];

export const ThreeOptions: Story = {
  args: {
    ariaLabel: "Model",
    value: "sonnet",
    options: modelOptions,
    onChange: () => undefined,
  },
};

export const Disabled: Story = {
  args: {
    ariaLabel: "Model",
    value: "sonnet",
    options: modelOptions,
    disabled: true,
    onChange: () => undefined,
  },
};

export const Block: Story = {
  args: {
    ariaLabel: "Provider",
    value: "cursor",
    block: true,
    options: [
      { value: "cursor", label: "Cursor" },
      { value: "codex", label: "Codex" },
    ],
    onChange: () => undefined,
  },
};
