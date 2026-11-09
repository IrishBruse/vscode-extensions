import type { Meta, StoryObj } from "@storybook/react-vite";
import { CursorCreatePlanDialog } from "./CursorCreatePlanDialog";

const meta = {
  title: "ACP/Dialogs/CursorCreatePlanDialog",
  component: CursorCreatePlanDialog,
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
      plan: "1. Move dialog components into dedicated folders.\n2. Update shared CSS imports.\n3. Add Storybook stories for each dialog.",
      todos: [],
    },
    onAccept: () => undefined,
    onReject: () => undefined,
    onCancel: () => undefined,
  },
};
