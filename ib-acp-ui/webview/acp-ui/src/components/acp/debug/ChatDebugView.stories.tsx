import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactElement } from "react";
import type { TraceItem } from "../../../chatReducer";
import { ChatDebugView } from "./ChatDebugView";

function tool(
  toolCallId: string,
  title: string,
  kind: string,
  durationMs: number,
): TraceItem {
  return {
    type: "tool",
    toolCallId,
    title,
    kind,
    subtitle: undefined,
    status: "completed",
    content: undefined,
    diffRows: undefined,
    detailVisible: false,
    durationMs,
  };
}

const trace: TraceItem[] = [
  { type: "user", text: "align the debug list" },
  tool("s1", "Find `**/AGENTS.md`", "search", 1),
  tool("r1", "Read ib-acp-ui/docs/features/ui/chat-trace.md", "read", 1),
  tool("e1", "Write ChatDebugView.css", "edit", 12),
  tool("x1", "vp check", "execute", 840),
  {
    type: "subagent",
    sessionId: "child-1",
    title: "Explore the sidebar",
    description: "Find the setup view",
    state: "idle",
    stopReason: null,
  },
];

const childTraces = new Map([
  [
    "child-1",
    {
      trace: [
        tool("c1", "Read setup.ts", "read", 2),
        tool("c2", "Find session view", "search", 4),
        tool("c3", "Read acpUiSetupTree.ts", "read", 3),
      ],
    },
  ],
]);

function Frame(): ReactElement {
  return (
    <div style={{ height: 640 }}>
      <ChatDebugView
        trace={trace}
        title="ACP UI Autocomplete"
        agentName="Cursor"
        childTraces={childTraces}
      />
    </div>
  );
}

const meta = {
  title: "ACP/Debug/ChatDebugView",
  component: Frame,
} satisfies Meta<typeof Frame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
