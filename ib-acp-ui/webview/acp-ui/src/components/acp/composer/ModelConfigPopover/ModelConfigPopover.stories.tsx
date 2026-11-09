import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AcpUiSessionConfigOption } from "../../../../../../../src/acp/session/sessionConfigOptions";
import { ModelConfigPopover } from "./ModelConfigPopover";

const sampleOptions: AcpUiSessionConfigOption[] = [
  {
    configId: "effort",
    name: "Effort",
    type: "select",
    currentValue: "medium",
    options: [
      { value: "low", name: "Low" },
      { value: "medium", name: "Medium" },
      { value: "high", name: "High" },
    ],
  },
];

const meta = {
  title: "ACP/Composer/ModelConfigPopover",
  component: ModelConfigPopover,
} satisfies Meta<typeof ModelConfigPopover>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSelectOption: Story = {
  args: {
    summaryLabel: "Sonnet · Medium",
    options: sampleOptions,
    disabled: false,
    onPick: () => undefined,
  },
};
