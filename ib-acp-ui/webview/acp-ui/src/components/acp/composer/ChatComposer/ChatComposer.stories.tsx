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
  onDismissFollowUp: noop,
  onEditFollowUp: noop,
  onCancel: noop,
  onKeyDown: noop,
  onPaste: noop,
  pendingImages: [],
  onRemoveImage: noop,
  onOpenImage: noop,
  tokenUsage: null,
} satisfies Omit<ChatComposerProps, "promptInFlight">;

const meta = {
  title: "ACP/Composer/ChatComposer",
  component: ChatComposer,
  parameters: { pinBottom: true },
} satisfies Meta<typeof ChatComposer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: {
    ...baseProps,
    promptInFlight: false,
  },
};

export const Running: Story = {
  args: {
    ...baseProps,
    promptInFlight: true,
    draft: "Follow up when ready",
  },
};

export const SlashSuggestions: Story = {
  args: {
    ...baseProps,
    promptInFlight: false,
    draft: "/cl",
    slashCommands: [
      { name: "clear", description: "Start a new chat" },
      { name: "compact", description: "Summarize the transcript" },
    ],
  },
};

export const FileMentions: Story = {
  args: {
    ...baseProps,
    promptInFlight: false,
    draft: "@src/ext",
    workspaceFiles: ["src/extension.ts", "src/extensionHostMessages.ts", "webview/acp-ui/src/AcpUiApp.tsx"],
  },
};

export const PendingImage: Story = {
  args: {
    ...baseProps,
    promptInFlight: false,
    draft: "What is in this screenshot?",
    pendingImages: [
      {
        mimeType: "image/png",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      },
    ],
  },
};

export const FollowUpQueued: Story = {
  args: {
    ...baseProps,
    promptInFlight: true,
    draft: "",
    followUp: { body: "Also check the failing test.", images: [], mode: "queue" },
  },
};

export const InputBlocked: Story = {
  args: {
    ...baseProps,
    promptInFlight: true,
    inputBlocked: true,
    draft: "npm test",
  },
};

export const ConfigLoading: Story = {
  args: {
    ...baseProps,
    promptInFlight: false,
    modelSelection: null,
    sessionConfigLoading: true,
  },
};
