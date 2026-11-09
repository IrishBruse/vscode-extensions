import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AcpUiSessionConfigOption } from "../../../../../src/acp/session/sessionConfigOptions";
import {
  ComposerConfigLoading,
  ConfigOptionControls,
} from "./ConfigOptionControls";

const sampleOptions: AcpUiSessionConfigOption[] = [
  {
    configId: "model",
    name: "Model",
    category: "model",
    type: "select",
    currentValue: "sonnet",
    options: [
      { value: "opus", name: "Opus" },
      { value: "sonnet", name: "Sonnet" },
    ],
  },
  {
    configId: "fast",
    name: "Fast mode",
    type: "boolean",
    currentValue: true,
  },
];

const meta = {
  title: "ACP UI/ConfigOptionControls",
  component: ConfigOptionControls,
} satisfies Meta<typeof ConfigOptionControls>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SelectAndBoolean: Story = {
  args: {
    options: sampleOptions,
    disabled: false,
    onPick: () => undefined,
  },
};

export const Loading: StoryObj<typeof ComposerConfigLoading> = {
  render: (args) => <ComposerConfigLoading {...args} />,
  args: {
    label: "Model",
    layout: "stacked",
  },
};
