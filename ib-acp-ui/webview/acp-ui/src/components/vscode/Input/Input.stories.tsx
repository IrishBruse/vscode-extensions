import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Input, type InputProps } from "./Input";

const meta = {
  title: "VS Code/Input",
  component: Input,
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

function Editable(props: InputProps) {
  const [value, setValue] = useState(props.value);
  return <Input {...props} value={value} onChange={setValue} />;
}

export const FontSize: Story = {
  args: {
    description: "Controls the font size in pixels",
    ariaLabel: "Font size",
    value: "12",
    modified: true,
    onChange: () => undefined,
  },
  render: (args) => (
    <div style={{ maxWidth: 280 }}>
      <Editable {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    description: "Controls the font size in pixels",
    ariaLabel: "Font size",
    value: "12",
    modified: true,
    disabled: true,
    onChange: () => undefined,
  },
};
