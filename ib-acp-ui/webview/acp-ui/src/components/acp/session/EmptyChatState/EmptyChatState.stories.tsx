import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AcpUiRecentSession } from "../../../../../../../src/protocol/extensionHostMessages";
import { EmptyChatState } from "./EmptyChatState";

const recentSessions: AcpUiRecentSession[] = [
  {
    id: "session-1",
    title: "Refactor auth middleware",
    updatedAt: Date.now() - 60_000,
  },
  {
    id: "session-2",
    title: "Debug webview message loop",
    updatedAt: Date.now() - 3_600_000,
  },
];

const meta = {
  title: "ACP/Session/EmptyChatState",
  component: EmptyChatState,
} satisfies Meta<typeof EmptyChatState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    providers: ["cursor-agent", "codex"],
    currentProvider: "cursor-agent",
    recentSessions,
    onPickProvider: () => undefined,
    onOpenSession: () => undefined,
  },
};
