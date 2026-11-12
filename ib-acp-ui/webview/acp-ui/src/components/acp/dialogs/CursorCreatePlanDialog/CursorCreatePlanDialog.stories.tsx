import type { Meta, StoryObj } from "@storybook/react-vite";
import { DialogStoryFrame } from "../DialogStoryFrame";
import { CursorCreatePlanDialog } from "./CursorCreatePlanDialog";

const meta = {
  title: "ACP/Dialogs/CursorCreatePlanDialog",
  component: CursorCreatePlanDialog,
  decorators: [
    (Story) => (
      <DialogStoryFrame>
        <Story />
      </DialogStoryFrame>
    ),
  ],
} satisfies Meta<typeof CursorCreatePlanDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    request: {
      type: "cursorCreatePlanRequest",
      requestId: "story-plan-1",
      name: "Add permission dialog stories",
      overview: "Reorganize ACP UI dialogs into folders and wire Storybook.",
      plan: [
        "## Check",
        "",
        "- Move dialog components into dedicated folders.",
        "- Update shared CSS imports.",
        "- Add Storybook stories for each dialog.",
        "- Add a changelog **Change** bullet under Unreleased.",
      ].join("\n"),
      todos: [],
    },
    onAccept: () => undefined,
    onReject: () => undefined,
    onCancel: () => undefined,
    onOpenPlan: () => undefined,
  },
};
