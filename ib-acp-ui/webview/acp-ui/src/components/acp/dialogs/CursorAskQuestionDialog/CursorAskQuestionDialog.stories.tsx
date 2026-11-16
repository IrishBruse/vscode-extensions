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

export const GettingOriented: Story = {
    args: {
        request: {
            type: "cursorAskQuestionRequest",
            requestId: "story-ask-oriented",
            title: "Getting oriented",
            questions: [
                {
                    id: "focus",
                    prompt: "What would you like to focus on in this session?",
                    options: [
                        { id: "code", label: "Writing or fixing code in a project" },
                        { id: "explore", label: "Exploring or understanding a codebase" },
                        { id: "git", label: "Git, branches, commits, or pull requests" },
                        {
                            id: "setup",
                            label: "Cursor setup (rules, skills, hooks, agents)",
                        },
                        { id: "other", label: "Other: (type to answer)" },
                    ],
                },
                {
                    id: "checks",
                    prompt: "Which checks should run?",
                    allowMultiple: true,
                    options: [
                        { id: "unit", label: "Unit tests" },
                        { id: "browser", label: "Browser tests" },
                    ],
                },
                {
                    id: "depth",
                    prompt: "How deep should the agent go?",
                    options: [
                        { id: "quick", label: "Quick skim" },
                        { id: "full", label: "Full pass" },
                    ],
                },
            ],
        },
        onSubmit: () => undefined,
        onSkip: () => undefined,
    },
};

export const SingleQuestion: Story = {
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
        onSkip: () => undefined,
    },
};