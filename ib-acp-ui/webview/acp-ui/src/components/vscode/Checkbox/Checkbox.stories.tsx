import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Checkbox, type CheckboxProps } from "./Checkbox";

const meta = {
  title: "VS Code/Checkbox",
  component: Checkbox,
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

function Toggleable(props: CheckboxProps) {
  const [checked, setChecked] = useState(props.checked);
  return <Checkbox {...props} checked={checked} onChange={setChecked} />;
}

export const Unchecked: Story = {
  args: {
    ariaLabel: "Task",
    checked: false,
    onChange: () => undefined,
  },
  render: (args) => <Toggleable {...args} />,
};

export const Checked: Story = {
  args: {
    ariaLabel: "Task",
    checked: true,
    onChange: () => undefined,
  },
  render: (args) => <Toggleable {...args} />,
};

export const Disabled: Story = {
  args: {
    ariaLabel: "Task",
    checked: true,
    disabled: true,
    onChange: () => undefined,
  },
};
