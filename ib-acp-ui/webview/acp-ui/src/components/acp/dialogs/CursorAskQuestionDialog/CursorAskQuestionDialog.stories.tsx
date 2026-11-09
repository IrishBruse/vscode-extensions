import type { Meta, StoryObj } from "@storybook/react-vite";
import { DialogStoryFrame } from "../DialogStoryFrame";
import { CursorAskQuestionDialog } from "./CursorAskQuestionDialog";

const meta = {
  title: "ACP/Dialogs/CursorAskQuestionDialog",
  component: CursorAskQuestionDialog,
  decorators: [
    (Story) => (
      <DialogStoryFrame>
        <Story />
      </DialogStoryFrame>
    ),
  ],
} satisfies Meta<typeof CursorAskQuestionDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    request: {
      type: "cursorAskQuestionRequest",
      requestId: "story-ask-1",
      title: "Choose a direction",
      questions: [
        {
          id: "q1",
          prompt: "Which approach should the agent take?",
          options: [
            { id: "opt-a", label: "Incremental refactor" },
            { id: "opt-b", label: "Rewrite module" },
          ],
        },
      ],
    },
    onSubmit: () => undefined,
    onCancel: () => undefined,
  },
};
