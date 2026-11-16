import { describe, expect, it } from "vite-plus/test";
import { buildChatDebug } from "./chatDebugModel";
import type { TraceItem } from "./chatReducer";
import { setCompactToolPathHome, setCompactToolWorkspaceRoot } from "./toolCallCompactText";

function tool(
  toolCallId: string,
  title: string,
  kind: string,
  status: "completed" | "in_progress" | "failed" = "completed",
): TraceItem {
  return {
    type: "tool",
    toolCallId,
    title,
    kind,
    subtitle: undefined,
    status,
    content: undefined,
    diffRows: undefined,
    detailVisible: false,
  };
}

describe("buildChatDebug", () => {
  it("keeps requests and groups the tools that follow them", () => {
    const model = buildChatDebug(
      [
        { type: "user", text: "commit the timer" },
        tool("read-1", "chatReducer.ts", "read"),
        tool("read-2", "acpUiSessionsView.ts", "read"),
        tool("run-1", "git status", "execute", "failed"),
        {
          type: "subagent",
          sessionId: "child-1",
          title: "Explore the sidebar",
          description: "Find the setup view",
          state: "idle",
          stopReason: null,
        },
      ],
      "New Cursor chat",
    );
    expect(model.workingDirectory).toBe("");
    expect(model.stats).toEqual([
      { value: "1", label: "turns" },
      { value: "3", label: "tools" },
      { value: "1", label: "subagents" },
    ]);
    expect(model.nodes.map((node) => [node.tone, node.label, node.calls.length])).toEqual([
      ["orch", "Chat", 3],
      ["subagent", "Explore the sidebar", 1],
    ]);
    expect(model.nodes[0]?.calls.map((call) => call.kind)).toEqual(["Read", "Read", "Shell"]);
    expect(model.nodes[0]?.calls.map((call) => call.tone)).toEqual(["read", "read", "shell"]);
    expect(model.nodes[0]?.calls[2]?.meta).toBe("Failed");
  });

  it("shows the workspace folder when no shell cwd is known", () => {
    setCompactToolPathHome("/home/econn");
    setCompactToolWorkspaceRoot("/home/econn/git/vscode-extensions");
    const model = buildChatDebug([], "New Cursor chat");
    expect(model.workingDirectory).toBe("~/git/vscode-extensions");
  });

  it("shows a Web Fetch URL in the call list", () => {
    const model = buildChatDebug(
      [
        {
          type: "tool",
          toolCallId: "fetch-1",
          title: "Web Fetch",
          kind: undefined,
          subtitle: "https://agentclientprotocol.com/protocol",
          status: "completed",
          content: undefined,
          diffRows: undefined,
          detailVisible: false,
        },
      ],
      "Chat",
    );
    expect(model.nodes[0]?.calls[0]?.title).toBe("https://agentclientprotocol.com/protocol");
  });

  it("shows the latest shell cwd from the main trace", () => {
    setCompactToolPathHome("/home/econn");
    setCompactToolWorkspaceRoot("/home/econn/git/vscode-extensions");
    const model = buildChatDebug(
      [
        { type: "user", text: "run ls" },
        {
          type: "tool",
          toolCallId: "run-1",
          title: "ls",
          kind: "execute",
          subtitle: "ls",
          status: "completed",
          content: undefined,
          diffRows: undefined,
          detailVisible: false,
          cwd: "/home/econn/git/vscode-extensions/ib-acp-ui",
        },
      ],
      "Chat",
    );
    expect(model.workingDirectory).toBe("~/git/vscode-extensions/ib-acp-ui");
  });

  it("fills a subagent step with that child's tool calls", () => {
    const model = buildChatDebug(
      [
        {
          type: "subagent",
          sessionId: "child-1",
          title: "Explore the sidebar",
          description: "Find the setup view",
          state: "idle",
          stopReason: null,
        },
      ],
      "Chat",
      new Map([
        [
          "child-1",
          {
            trace: [tool("read-1", "setup.ts", "read"), tool("find-1", "AGENTS.md", "search")],
          },
        ],
      ]),
    );
    expect(model.nodes.map((node) => [node.tone, node.calls.length])).toEqual([["subagent", 2]]);
    expect(model.nodes[0]?.calls.map((call) => call.tone)).toEqual(["read", "search"]);
  });

  it("fills a task step with the tools that subagent called", () => {
    const model = buildChatDebug(
      [
        {
          type: "tool",
          toolCallId: "task-1",
          title: "Task: Decompile pause course call",
          kind: "other",
          subtitle: "generalPurpose",
          status: "completed",
          content: "Decompile NSMBU function 0x025FE554.",
          diffRows: undefined,
          detailVisible: true,
          durationMs: 132_300,
        },
      ],
      "Chat",
      undefined,
      new Map([
        [
          "task-1",
          [
            tool("read-1", "PauseGame.cpp", "read"),
            tool("run-1", "decompile 0x025FE554", "execute"),
          ],
        ],
      ]),
    );
    expect(model.nodes.map((node) => [node.label, node.calls.length])).toEqual([
      ["Decompile pause cours…", 2],
    ]);
    expect(model.nodes[0]?.calls.map((call) => call.tone)).toEqual(["read", "shell"]);
    expect(model.nodes[0]?.calls.map((call) => call.title)).toEqual([
      "PauseGame.cpp",
      "decompile 0x025FE554",
    ]);
  });
});
