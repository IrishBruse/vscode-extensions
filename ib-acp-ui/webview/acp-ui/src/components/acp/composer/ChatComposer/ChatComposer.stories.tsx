import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatComposer, type ChatComposerProps } from "./ChatComposer";

const noop = () => undefined;

const baseProps = {
  workspacePathHint: "/workspace/project",
  modelSelection: {
    currentModelId: "gpt-4",
    availableModels: [{ modelId: "gpt-4", name: "GPT-4" }],
  },
  sessionConfigOptions: null,
  sessionConfigLoading: false,
  modelPickerLocked: false,
  hideComposerModelControls: false,
  inputBlocked: false,
  slashCommands: [],
  workspaceFiles: [],
  suggestionIndex: 0,
  autocompleteDismissed: false,
  draft: "",
  onDraftChange: noop,
  onDismissAutocomplete: noop,
  onPickSessionModel: noop,
  onPickSessionConfigOption: noop,
  onSubmit: noop,
  onCancel: noop,
  onKeyDown: noop,
  onPaste: noop,
  pendingImages: [],
  onRemoveImage: noop,
  onOpenImage: noop,
  tokenUsage: null,
} satisfies Omit<ChatComposerProps, "activityLabel" | "promptInFlight">;

const meta = {
  title: "ACP/Composer/ChatComposer",
  component: ChatComposer,
} satisfies Meta<typeof ChatComposer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: {
    ...baseProps,
    activityLabel: null,
    promptInFlight: false,
  },
};

export const Running: Story = {
  args: {
    ...baseProps,
    activityLabel: "Agent is thinking…",
    promptInFlight: true,
    draft: "Follow up when ready",
  },
};
