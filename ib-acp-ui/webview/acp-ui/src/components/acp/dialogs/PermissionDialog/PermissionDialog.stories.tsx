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

export const WriteFile: Story = {
  args: {
    toolTitle: "Write File",
    detail: "docs/test.md",
    summary: "1 line(s) before -> 1 line(s) after",
    diffRows: [
      { kind: "removed", text: "a", line: 1 },
      { kind: "added", text: "b", line: 1 },
    ],
    options: [
      { optionId: "allow-once", name: "Allow once" },
      { optionId: "allow-always", name: "Allow always" },
      { optionId: "reject", name: "Reject" },
    ],
    onSelect: () => undefined,
    onDismiss: () => undefined,
  },
};

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
