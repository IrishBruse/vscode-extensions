import type { Meta, StoryObj } from "@storybook/react-vite";
import { DialogStoryFrame } from "../DialogStoryFrame";
import { PermissionDialog } from "./PermissionDialog";

const meta = {
  title: "ACP/Dialogs/PermissionDialog",
  component: PermissionDialog,
  decorators: [
    (Story) => (
      <DialogStoryFrame>
        <Story />
      </DialogStoryFrame>
    ),
  ],
} satisfies Meta<typeof PermissionDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    toolTitle: "Run shell command",
    options: [
      { optionId: "allow-once", name: "Allow once" },
      { optionId: "reject", name: "Reject" },
    ],
    onSelect: () => undefined,
    onDismiss: () => undefined,
  },
};
