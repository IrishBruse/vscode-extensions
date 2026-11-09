import type { Meta, StoryObj } from "@storybook/react-vite";
import cursorSeed from "../../../../../fixtures/cursor-model-seed.json?raw";
import markdownChat from "../../../../../fixtures/chats/markdown.ndjson?raw";
import planChat from "../../../../../fixtures/chats/plan.ndjson?raw";
import showcaseChat from "../../../../../fixtures/chats/showcase.ndjson?raw";
import toolsChat from "../../../../../fixtures/chats/tools.ndjson?raw";
import opusSeed from "../../../../../fixtures/opus-model-seed.json?raw";
import type { ExtensionMessageAfterInit } from "../../chatReducer";
import { ScenarioChat } from "./ScenarioChat";

function sessionUpdate(update: Record<string, unknown>): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    method: "session/update",
    params: { sessionId: "storybook", update },
  });
}

function userText(text: string): string {
  return sessionUpdate({
    sessionUpdate: "user_message_chunk",
    content: { type: "text", text },
  });
}

function toolCall(toolCallId: string, title: string, kind: string, rawInput?: unknown): string {
  return sessionUpdate({
    sessionUpdate: "tool_call",
    toolCallId,
    title,
    kind,
    status: "pending",
    rawInput: rawInput ?? {},
  });
}

function toolUpdate(toolCallId: string, status: string, extra?: Record<string, unknown>): string {
  return sessionUpdate({
    sessionUpdate: "tool_call_update",
    toolCallId,
    status,
    ...extra,
  });
}

const permissionChat = [
  userText("Run the webview tests."),
  toolCall("tool-test", "npm test", "execute"),
  JSON.stringify({
    jsonrpc: "2.0",
    method: "session/request_permission",
    params: {
      sessionId: "storybook",
      toolCall: {
        toolCallId: "tool-test",
        title: "npm test",
        kind: "execute",
        status: "pending",
      },
      options: [
        { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
        { optionId: "reject", name: "Reject", kind: "reject_once" },
      ],
    },
  }),
].join("\n");

const subagentChat = [
  userText("Explore how session history is loaded."),
  toolCall("task-1", "Task: Explore session history", "other", {
    _toolName: "task",
    description: "Explore session history",
    subagentType: "explore",
    prompt:
      "Find the session history loader.\nNote when the cache is shown.\nNote when the overlay is shown.\nList the files you read.\nStop after the loader component.",
  }),
  toolUpdate("task-1", "completed", { rawOutput: { durationMs: 8400 } }),
].join("\n");

const failedToolChat = [
  userText("Run the webview tests."),
  toolCall("tool-test", "npm test", "execute"),
  toolUpdate("tool-test", "failed", {
    rawOutput: { content: "$ npm test\nFAIL src/chatReducer.test.ts\nENOENT: missing fixture" },
  }),
].join("\n");

const askQuestion: ExtensionMessageAfterInit = {
  type: "cursorAskQuestionRequest",
  requestId: "ask-1",
  title: "Choose a direction",
  questions: [
    {
      id: "q1",
      prompt: "Which approach should the agent take?",
      options: [
        { id: "opt-a", label: "Incremental refactor" },
        { id: "opt-b", label: "Rewrite the module" },
      ],
    },
    {
      id: "q2",
      prompt: "Which checks should run?",
      allowMultiple: true,
      options: [
        { id: "unit", label: "Unit tests" },
        { id: "browser", label: "Browser tests" },
      ],
    },
  ],
};

const createPlan: ExtensionMessageAfterInit = {
  type: "cursorCreatePlanRequest",
  requestId: "plan-1",
  name: "Split the trace components",
  overview: "Group the chat controls and keep the transcript behavior the same.",
  plan: "1. Move trace blocks into folders.\n2. Add stories for each state.\n3. Replay the fixture chats in Storybook.",
  todos: [],
};

const meta = {
  title: "Scenarios",
  component: ScenarioChat,
  parameters: { fullWidth: true },
} satisfies Meta<typeof ScenarioChat>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Showcase: Story = {
  args: { ndjson: showcaseChat, seedText: cursorSeed },
};

export const Markdown: Story = {
  args: { ndjson: markdownChat, seedText: cursorSeed },
};

export const Tools: Story = {
  args: { ndjson: toolsChat, seedText: cursorSeed },
};

export const Plan: Story = {
  args: { ndjson: planChat, seedText: cursorSeed },
};

export const CursorModel: Story = {
  args: { ndjson: "", seedText: cursorSeed },
};

export const OpusModel: Story = {
  args: { ndjson: "", seedText: opusSeed },
};

export const Permission: Story = {
  args: { ndjson: permissionChat, seedText: cursorSeed },
};

export const Subagent: Story = {
  args: { ndjson: subagentChat, seedText: cursorSeed },
};

export const FailedTool: Story = {
  args: { ndjson: failedToolChat, seedText: cursorSeed },
};

export const AskQuestion: Story = {
  args: {
    ndjson: userText("How should I change the trace?"),
    seedText: cursorSeed,
    extraMessages: [askQuestion],
  },
};

export const CreatePlan: Story = {
  args: { ndjson: userText("Plan the component folders."), seedText: cursorSeed, extraMessages: [createPlan] },
};

export const HistoryLoading: Story = {
  args: {
    ndjson: "",
    seedText: cursorSeed,
    extraMessages: [{ type: "sessionHistoryLoading", loading: true }],
  },
};
