import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button, type ButtonProps } from "./Button";

const meta = {
  title: "VS Code/Button",
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

function Clickable(props: ButtonProps) {
  const [count, setCount] = useState(0);
  return (
    <Button
      {...props}
      onClick={() => {
        setCount((current) => current + 1);
      }}
    >
      {props.children}
      {count > 0 ? ` (${count})` : ""}
    </Button>
  );
}

export const Primary: Story = {
  args: {
    children: "Allow",
  },
  render: (args) => <Clickable {...args} />,
};

export const Secondary: Story = {
  args: {
    children: "Dismiss",
    variant: "secondary",
  },
  render: (args) => <Clickable {...args} />,
};

export const Disabled: Story = {
  args: {
    children: "Allow",
    disabled: true,
  },
};
