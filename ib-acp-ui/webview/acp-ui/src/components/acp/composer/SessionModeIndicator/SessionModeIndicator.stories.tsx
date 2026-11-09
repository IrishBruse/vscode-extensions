import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AcpUiSessionConfigOption } from "../../../../../../../src/acp/session/sessionConfigOptions";
import { SessionModeIndicator } from "./SessionModeIndicator";

const planModeOption: Extract<AcpUiSessionConfigOption, { type: "select" }> = {
  configId: "mode",
  name: "Mode",
  category: "mode",
  type: "select",
  currentValue: "plan",
  options: [
    { value: "agent", name: "Agent" },
    { value: "plan", name: "Plan mode" },
  ],
};

const meta = {
  title: "ACP/Composer/SessionModeIndicator",
  component: SessionModeIndicator,
} satisfies Meta<typeof SessionModeIndicator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlanMode: Story = {
  args: {
    modeOption: planModeOption,
  },
};
