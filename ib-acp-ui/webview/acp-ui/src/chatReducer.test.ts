import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  cursorChildSessionNotificationFromLine,
  cursorSubagentUpdateMessage,
} from "../../../src/acp/mapping/sessionUpdateMapping";
import { canonicalToolCallId } from "../../../src/acp/mapping/canonicalToolCallId";
import {
  type ChatAction,
  chatReducer,
  createChatStateFromInit,
  createInitialChatState,
  joinThoughtChunks,
  mergeThoughtDurationsFromCache,
  replayChatState,
  runningBashStartedAtMs,
  traceCoversSubagentSession,
} from "./chatReducer";
import {
  writeCachedModelParamOptions,
  writeCachedSessionConfigOptions,
} from "../../../src/acp/session/sessionConfigOptionsCache";

describe("chatReducer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("measures thought duration client-side when the agent omits durationMs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let state = createInitialChatState();
    state = chatReducer(state, { type: "appendAgentThought", text: "Thinking…" });
    expect(state.thoughtStartedAtMs).toBe(Date.now());
    vi.advanceTimersByTime(450);
    state = chatReducer(state, { type: "appendAgentText", text: "Answer" });
    const thought = state.trace[0];
    expect(thought?.type).toBe("thought");
    if (thought?.type !== "thought") {
      return;
    }
    expect(thought.durationMs).toBe(450);
    expect(state.thoughtStartedAtMs).toBeNull();
  });

  it("stores context window usage from tokenUsage", () => {
    let state = createInitialChatState();
    expect(state.tokenUsage).toBeNull();
    state = chatReducer(state, { type: "tokenUsage", used: 12345, size: 200000 });
    expect(state.tokenUsage).toEqual({ used: 12345, size: 200000 });
    state = chatReducer(state, { type: "tokenUsage", used: 800 });
    expect(state.tokenUsage).toEqual({ used: 800, size: 200000 });
    state = chatReducer(state, { type: "tokenUsage", size: 300_000 });
    expect(state.tokenUsage).toEqual({ used: 800, size: 300_000 });
    const fresh = chatReducer(createInitialChatState(), { type: "tokenUsage", size: 200_000 });
    expect(fresh.tokenUsage).toEqual({ used: null, size: 200_000 });
  });

  it("keeps agent-provided thought duration over client timing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let state = createInitialChatState();
    state = chatReducer(state, { type: "appendAgentThought", text: "A", durationMs: 1200 });
    vi.advanceTimersByTime(5000);
    state = chatReducer(state, { type: "turnComplete", stopReason: "end" });
    const thought = state.trace[0];
    expect(thought?.type).toBe("thought");
    if (thought?.type !== "thought") {
      return;
    }
    expect(thought.durationMs).toBe(1200);
  });

  it("finalizes client thought duration when a new tool call opens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let state = createInitialChatState();
    state = chatReducer(state, { type: "appendAgentThought", text: "Plan tool" });
    vi.advanceTimersByTime(200);
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "t1",
      title: "Run",
      kind: "execute",
      status: "pending",
      subtitle: undefined,
    });
    const thought = state.trace[0];
    expect(thought?.type).toBe("thought");
    if (thought?.type !== "thought") {
      return;
    }
    expect(thought.durationMs).toBe(200);
  });

  it("keeps a bash working directory when a later update omits it", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "exec1",
      title: "Run",
      kind: "execute",
      status: "pending",
      subtitle: "echo test",
      cwd: "/home/econn/foo/bar",
    });
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId: "exec1",
      status: "completed",
      content: "test",
    });
    const tool = state.trace[0];
    expect(tool?.type).toBe("tool");
    if (tool?.type !== "tool") {
      return;
    }
    expect(tool.cwd).toBe("/home/econn/foo/bar");
    expect(tool.subtitle).toBe("echo test");
  });

  it("measures command duration client-side when the agent omits durationMs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "exec1",
      title: "Run",
      kind: "execute",
      status: "pending",
      subtitle: "ls -la tests",
    });
    expect(state.toolStartedAtMsById.get("exec1")).toBe(Date.now());
    const pending = state.trace[0];
    expect(pending?.type).toBe("tool");
    if (pending?.type === "tool") {
      expect(pending.startedAtMs).toBe(Date.now());
    }
    expect(runningBashStartedAtMs(state.trace)).toBe(Date.now());
    vi.advanceTimersByTime(117);
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId: "exec1",
      status: "completed",
      content: "total 0",
    });
    const tool = state.trace[0];
    expect(tool?.type).toBe("tool");
    if (tool?.type !== "tool") {
      return;
    }
    expect(tool.durationMs).toBe(117);
    expect(tool.startedAtMs).toBeUndefined();
    expect(runningBashStartedAtMs(state.trace)).toBeUndefined();
    expect(state.toolStartedAtMsById.has("exec1")).toBe(false);
  });

  it("keeps agent-provided command duration over client timing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "exec1",
      title: "Run",
      kind: "execute",
      status: "in_progress",
      subtitle: "pwd",
    });
    vi.advanceTimersByTime(5000);
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId: "exec1",
      status: "completed",
      durationMs: 88,
    });
    const tool = state.trace[0];
    expect(tool?.type).toBe("tool");
    if (tool?.type !== "tool") {
      return;
    }
    expect(tool.durationMs).toBe(88);
  });

  it("merges appendAgentThought chunks into one thought row", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendAgentThought",
      text: "Considering test execution\n",
      durationMs: 700,
    });
    state = chatReducer(state, {
      type: "appendAgentThought",
      text: "Need to validate before continuing.",
    });
    expect(state.trace).toHaveLength(1);
    const row = state.trace[0];
    expect(row?.type).toBe("thought");
    if (row?.type !== "thought") {
      return;
    }
    expect(row.durationMs).toBe(700);
    expect(row.text).toContain("Considering test execution");
    expect(row.text).toContain("Need to validate");
  });

  it("concatenates streamed thought chunks without inserting extra spaces", () => {
    expect(joinThoughtChunks("hel", "lo")).toBe("hello");
    expect(joinThoughtChunks("hello", "world")).toBe("helloworld");
    expect(joinThoughtChunks("hello ", "world")).toBe("hello world");
    expect(joinThoughtChunks("hello", ", world")).toBe("hello, world");
  });

  it("does not alter spacing inside fenced code block streams", () => {
    expect(joinThoughtChunks("```ts\nconst x", "=1;\n```")).toBe("```ts\nconst x=1;\n```");
  });

  it("keeps a grep pattern when a later update only sends a match count", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "grep-1",
      title: "grep",
      kind: "search",
      status: "pending",
      subtitle: '"plan" in src',
    });
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId: "grep-1",
      status: "completed",
      subtitle: "2 matches",
    });
    const tool = state.trace.find((item) => item.type === "tool");
    expect(tool).toMatchObject({ subtitle: '"plan" in src · 2 matches' });
  });

  it("merges appendToolCall into an existing tool row from an earlier updateToolCall", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId: "early",
      status: "pending",
      subtitle: "npm test",
      content: undefined,
      diffRows: undefined,
    });
    expect(state.trace).toHaveLength(1);
    const before = state.trace[0];
    expect(before?.type).toBe("tool");
    if (before?.type !== "tool") {
      return;
    }
    expect(before.title).toBe("Tool");
    expect(before.kind).toBeUndefined();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "early",
      title: "Run command",
      kind: "execute",
      status: "in_progress",
      subtitle: undefined,
    });
    expect(state.trace).toHaveLength(1);
    const after = state.trace[0];
    expect(after?.type).toBe("tool");
    if (after?.type !== "tool") {
      return;
    }
    expect(after.title).toBe("Run command");
    expect(after.kind).toBe("execute");
    expect(after.subtitle).toBe("npm test");
  });

  it("labels edit tools as Write File when only updateToolCall arrives (Gemini-style)", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId: "write-1",
      status: "completed",
      kind: "edit",
      subtitle: "/home/econn/git/irishbruse-acp/test.txt",
      diffRows: [{ kind: "added", text: "hello world" }],
    });
    expect(state.trace).toHaveLength(1);
    const row = state.trace[0];
    expect(row?.type).toBe("tool");
    if (row?.type !== "tool") {
      return;
    }
    expect(row.title).toBe("Write File");
    expect(row.kind).toBe("edit");
    expect(row.subtitle).toContain("test.txt");
  });

  it("merges Cursor multi-line toolCallId update onto the pending edit row with diff preview", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "call-c4d9d88d-ab6e-48ed-9ff3-5425c287173c-4",
      title: "Write File",
      kind: "edit",
      status: "pending",
      subtitle: undefined,
    });
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId:
        "call-c4d9d88d-ab6e-48ed-9ff3-5425c287173c-4\nfc_p5fq8ry-6jKPYy-8ee7667a-aws_ue1_0",
      status: "completed",
      subtitle: "/home/econn/git/irishbruse-utilities/docs/test.md",
      diffRows: [
        { kind: "removed", text: "old line" },
        { kind: "added", text: "new line" },
      ],
    });
    expect(state.trace).toHaveLength(1);
    const row = state.trace[0];
    expect(row?.type).toBe("tool");
    if (row?.type !== "tool") {
      return;
    }
    expect(row.toolCallId).toBe("call-c4d9d88d-ab6e-48ed-9ff3-5425c287173c-4");
    expect(row.status).toBe("completed");
    expect(row.detailVisible).toBe(true);
    expect(row.diffRows).toEqual([
      { kind: "removed", text: "old line" },
      { kind: "added", text: "new line" },
    ]);
    expect(row.subtitle).toContain("test.md");
  });

  it("restores detailVisible from cached diffRows when the flag was omitted", () => {
    const state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      visibleTrace: [
        {
          type: "tool",
          toolCallId: "write-cached",
          title: "Write File",
          kind: "edit",
          status: "completed",
          subtitle: "docs/test.md",
          diffRows: [{ kind: "added", text: "hello" }],
        },
      ],
    });
    expect(state.trace).toHaveLength(1);
    const row = state.trace[0];
    expect(row?.type).toBe("tool");
    if (row?.type !== "tool") {
      return;
    }
    expect(row.detailVisible).toBe(true);
  });

  it("bumps visibleTraceCacheEpoch when a turn completes", () => {
    let state = createInitialChatState();
    expect(state.visibleTraceCacheEpoch).toBe(0);
    state = chatReducer(state, { type: "submit", body: "hi" });
    state = chatReducer(state, { type: "appendAgentText", text: "hello" });
    expect(state.visibleTraceCacheEpoch).toBe(0);
    state = chatReducer(state, { type: "turnComplete", stopReason: "end" });
    expect(state.visibleTraceCacheEpoch).toBe(1);
  });

  it("keeps an image on a read and fills one in later without replacing it", () => {
    let state = createInitialChatState();
    const image = { data: "QUJD", mimeType: "image/png" };
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "read-img",
      title: "Read",
      kind: "read",
      status: "in_progress",
      subtitle: ".tmp/shot.png",
    });
    state = chatReducer(state, {
      type: "toolImage",
      toolCallId: "read-img",
      image,
    });
    state = chatReducer(state, {
      type: "toolImage",
      toolCallId: "read-img",
      image: { data: "OTHER", mimeType: "image/png" },
    });
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId: "read-img",
      status: "completed",
      image: { data: "FROMAGENT", mimeType: "image/png" },
    });
    expect(state.trace[0]).toMatchObject({
      type: "tool",
      subtitle: ".tmp/shot.png",
      status: "completed",
      image: { data: "FROMAGENT", mimeType: "image/png" },
    });
  });

  it("does not bump visibleTraceCacheEpoch while a turn is streaming", () => {
    let state = createInitialChatState();
    state = chatReducer(state, { type: "submit", body: "hi" });
    state = chatReducer(state, { type: "appendAgentText", text: "partial" });
    state = chatReducer(state, { type: "appendToolCall", toolCallId: "t1", title: "Read", status: "in_progress" });
    expect(state.visibleTraceCacheEpoch).toBe(0);
  });

  it("replays submit and agent text from persisted events", () => {
    const init = {
      type: "init" as const,
      sessionId: "s1",
      title: "Chat",
    };
    const state = replayChatState(init, [
      { type: "submit", body: "hello" },
      { type: "appendAgentText", text: "hi there" },
      { type: "turnComplete", stopReason: "end" },
    ]);
    expect(state.trace).toEqual([
      { type: "user", text: "hello" },
      { type: "agent", text: "hi there" },
    ]);
    expect(state.promptInFlight).toBe(false);
  });

  it("records image attachments on submit", () => {
    let state = createInitialChatState();
    const image = { data: "QUJD", mimeType: "image/png" };
    state = chatReducer(state, { type: "submit", body: "look", imageCount: 1, images: [image] });
    expect(state.trace).toEqual([{ type: "user", text: "look", imageCount: 1, images: [image] }]);
    state = chatReducer(state, { type: "appendUserText", text: " more" });
    expect(state.trace).toEqual([
      { type: "user", text: "look more", imageCount: 1, images: [image] },
    ]);

    state = chatReducer(state, { type: "promptImageSupport", supported: false });
    expect(state.promptImageSupported).toBe(false);
  });

  it("does not double user text when the agent echoes the prompt in full", () => {
    let state = createInitialChatState();
    state = chatReducer(state, { type: "submit", body: "test" });
    expect(state.trace).toEqual([{ type: "user", text: "test" }]);
    state = chatReducer(state, { type: "appendUserText", text: "test" });
    expect(state.trace).toEqual([{ type: "user", text: "test" }]);
  });

  it("does not double user text when the agent echoes the prompt in chunks", () => {
    let state = createInitialChatState();
    state = chatReducer(state, { type: "submit", body: "hello world" });
    expect(state.trace).toEqual([{ type: "user", text: "hello world" }]);
    state = chatReducer(state, { type: "appendUserText", text: "hello " });
    state = chatReducer(state, { type: "appendUserText", text: "world" });
    expect(state.trace).toEqual([{ type: "user", text: "hello world" }]);
  });

  it("does not double user text across sequential prompt turns", () => {
    let state = createInitialChatState();
    state = chatReducer(state, { type: "submit", body: "test" });
    state = chatReducer(state, { type: "appendUserText", text: "test" });
    state = chatReducer(state, { type: "appendAgentText", text: "Loud and clear!" });
    state = chatReducer(state, { type: "turnComplete", stopReason: "end_turn" });
    expect(state.trace).toEqual([
      { type: "user", text: "test" },
      { type: "agent", text: "Loud and clear!" },
    ]);

    state = chatReducer(state, { type: "submit", body: "hi" });
    state = chatReducer(state, { type: "appendUserText", text: "hi" });
    state = chatReducer(state, { type: "appendAgentText", text: "Hello!" });
    state = chatReducer(state, { type: "turnComplete", stopReason: "end_turn" });
    expect(state.trace).toEqual([
      { type: "user", text: "test" },
      { type: "agent", text: "Loud and clear!" },
      { type: "user", text: "hi" },
      { type: "agent", text: "Hello!" },
    ]);
  });

  it("clears model config on loading and restores on sessionConfigOptions", () => {
    const withOptions = chatReducer(
      {
        ...createInitialChatState(),
        sessionConfigOptions: [
          {
            configId: "model",
            name: "Model",
            category: "model",
            type: "select",
            currentValue: "claude-opus-4-8",
            options: [{ value: "claude-opus-4-8", name: "Opus 4.8" }],
          },
        ],
        sessionConfigLoading: false,
      },
      { type: "sessionConfigOptionsLoading" },
    );
    expect(withOptions.sessionConfigOptions).toBeNull();
    expect(withOptions.sessionConfigLoading).toBe(true);

    const restored = chatReducer(withOptions, {
      type: "sessionConfigOptions",
      options: [
        {
          configId: "model",
          name: "Model",
          category: "model",
          type: "select",
          currentValue: "claude-sonnet-4-6",
          options: [{ value: "claude-sonnet-4-6", name: "Sonnet 4.6" }],
        },
      ],
    });
    expect(restored.sessionConfigLoading).toBe(false);
    expect(restored.sessionConfigOptions?.[0]?.currentValue).toBe("claude-sonnet-4-6");
  });

  it("restores cached param options immediately after a model pick", () => {
    writeCachedModelParamOptions("cursor", "GPT 5.4", [
      {
        configId: "_derived:context",
        name: "Context",
        type: "select",
        currentValue: "272k",
        options: [{ value: "272k", name: "272K" }],
      },
      {
        configId: "_derived:reasoning",
        name: "Reasoning",
        type: "select",
        currentValue: "medium",
        options: [{ value: "medium", name: "Medium" }],
      },
    ]);
    const base = {
      ...createInitialChatState(),
      sessionConfigLoading: false,
      acpAgentSelection: {
        currentName: "cursor",
      },
      sessionConfigOptions: [
        {
          configId: "model",
          name: "Model",
          category: "model",
          type: "select" as const,
          currentValue: "claude-opus-4-8",
          options: [
            { value: "claude-opus-4-8", name: "Opus 4.8" },
            { value: "gpt-5.4", name: "GPT 5.4" },
          ],
        },
        {
          configId: "_derived:effort",
          name: "Effort",
          type: "select" as const,
          currentValue: "high",
          options: [{ value: "high", name: "High" }],
        },
      ],
    };
    const afterModelPick = chatReducer(base, {
      type: "pickSessionConfigOption",
      configId: "model",
      value: "gpt-5.4",
    });
    expect(afterModelPick.sessionConfigOptions?.map((row) => row.name)).toEqual([
      "Model",
      "Context",
      "Reasoning",
    ]);
  });

  it("tracks sessionHistoryLoading during ACP resume", () => {
    const loading = chatReducer(createInitialChatState(), {
      type: "sessionHistoryLoading",
      loading: true,
    });
    expect(loading.sessionHistoryLoading).toBe(true);

    const done = chatReducer(loading, {
      type: "sessionHistoryLoading",
      loading: false,
    });
    expect(done.sessionHistoryLoading).toBe(false);
  });

  it("clears transcript and unlocks composer picks on sessionReset", () => {
    let state = createInitialChatState();
    state = {
      ...state,
      trace: [{ type: "user", text: "hello" }],
      composerPicksLocked: true,
      promptInFlight: true,
      sessionConfigOptions: [
        {
          configId: "model",
          name: "Model",
          category: "model",
          type: "select",
          currentValue: "a",
          options: [{ value: "a", name: "A" }],
        },
      ],
    };
    const reset = chatReducer(state, { type: "sessionReset" });
    expect(reset.trace).toEqual([]);
    expect(reset.composerPicksLocked).toBe(false);
    expect(reset.promptInFlight).toBe(false);
    expect(reset.sessionConfigOptions).toBeNull();
    expect(reset.sessionConfigLoading).toBe(true);
  });

  it("appends pretty-RPC entries on acpRpcLine", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "acpRpcLine",
      line: '{"jsonrpc":"2.0","method":"ping"}',
      direction: "toAgent",
      agentName: "Cursor",
    });
    expect(state.acpRpcLines).toHaveLength(1);
    expect(state.acpRpcLines[0]).toMatchObject({
      id: 1,
      direction: "toAgent",
      raw: '{"jsonrpc":"2.0","method":"ping"}',
      agentName: "Cursor",
    });
    expect(state.nextAcpRpcLineId).toBe(2);
  });

  it("clears acpRpcLines on sessionReset", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "acpRpcLine",
      line: "{}",
      direction: "fromAgent",
    });
    const reset = chatReducer(state, { type: "sessionReset" });
    expect(reset.acpRpcLines).toEqual([]);
    expect(reset.nextAcpRpcLineId).toBe(1);
  });

  it("seeds sessionHistoryLoading from init when resuming a runtime session", () => {
    const state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      sessionHistoryLoading: true,
    });
    expect(state.sessionHistoryLoading).toBe(true);
    expect(state.trace).toEqual([]);
  });

  it("seeds the visible trace cache and buffers replay until load finishes", () => {
    const cached = [
      { type: "user" as const, text: "hi" },
      { type: "agent" as const, text: "Hi – what do you want to work on?" },
    ];
    let state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      sessionHistoryLoading: true,
      visibleTrace: cached,
    });
    expect(state.trace).toEqual(cached);
    expect(state.viewportCacheActive).toBe(true);

    state = chatReducer(state, { type: "appendUserText", text: "older" });
    expect(state.trace).toEqual(cached);
    expect(state.replayTrace).toEqual([{ type: "user", text: "older" }]);

    state = chatReducer(state, {
      type: "permissionRequest",
      requestId: "p1",
      toolTitle: "Read",
      options: [{ optionId: "allow", name: "Allow" }],
    });
    expect(state.permissionPrompt?.requestId).toBe("p1");
    expect(state.trace).toEqual(cached);

    state = chatReducer(state, { type: "sessionHistoryLoading", loading: false });
    expect(state.sessionHistoryLoading).toBe(false);
    expect(state.viewportCacheActive).toBe(false);
    expect(state.trace).toEqual([{ type: "user", text: "older" }]);
    expect(state.historyCommit).toBe(1);
  });

  it("answers a later permission of the same tool kind after Allow always", () => {
    const searchRequest = (requestId: string, title: string): ChatAction => ({
      type: "permissionRequest",
      requestId,
      toolTitle: title,
      toolKind: "search",
      options: [
        { optionId: "allow-once", name: "Allow once" },
        { optionId: "allow-always", name: "Allow always" },
      ],
    });
    let state = chatReducer(createInitialChatState(), searchRequest("p1", "Web search: one"));
    expect(state.permissionPrompt?.requestId).toBe("p1");
    expect(state.permissionPrompt?.toolKind).toBe("search");

    state = chatReducer(state, {
      type: "answerPermission",
      optionId: "allow-always",
      optionName: "Allow always",
      toolKind: "search",
    });
    expect(state.permissionPrompt).toBeNull();
    expect(state.allowedToolKinds).toEqual(["search"]);

    state = chatReducer(state, searchRequest("p2", "Web search: two"));
    expect(state.permissionPrompt).toBeNull();
    expect(state.autoPermissionResponse).toEqual({
      requestId: "p2",
      selectedOptionId: "allow-always",
    });
  });

  it("drops a permission dialog the host already answered", () => {
    let state = chatReducer(createInitialChatState(), {
      type: "permissionRequest",
      requestId: "p1",
      toolTitle: "Web search: one",
      toolKind: "search",
      options: [{ optionId: "allow-always", name: "Allow always" }],
    });
    state = chatReducer(state, { type: "permissionSettled", requestId: "p1" });
    expect(state.permissionPrompt).toBeNull();

    state = chatReducer(state, {
      type: "permissionRequest",
      requestId: "p1",
      toolTitle: "Web search: one",
      toolKind: "search",
      options: [{ optionId: "allow-always", name: "Allow always" }],
    });
    expect(state.permissionPrompt).toBeNull();
    expect(state.autoPermissionResponse).toBeNull();
  });

  it("keeps the saved thought duration when replay measures a shorter clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const cached = [
      { type: "thought" as const, text: "Planning the change.", durationMs: 3200 },
    ];
    let state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      sessionHistoryLoading: true,
      visibleTrace: cached,
    });
    state = chatReducer(state, { type: "appendAgentThought", text: "Planning the change." });
    vi.advanceTimersByTime(40);
    state = chatReducer(state, { type: "appendAgentText", text: "Done" });
    state = chatReducer(state, { type: "sessionHistoryLoading", loading: false });
    const thought = state.trace[0];
    expect(thought).toEqual({
      type: "thought",
      text: "Planning the change.",
      durationMs: 3200,
    });
  });

  it("restores an in-progress thought clock from the saved start time", () => {
    const startedAtMs = Date.now() - 2500;
    let state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      visibleTrace: [
        { type: "thought", text: "Still thinking.", startedAtMs },
      ],
    });
    expect(state.thoughtStartedAtMs).toBe(startedAtMs);
    expect(state.promptInFlight).toBe(true);
    const thought = state.trace[0];
    expect(thought).toEqual({ type: "thought", text: "Still thinking.", startedAtMs });
  });

  it("keeps Cancel available when a thought starts without a local submit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let state = createInitialChatState();
    state = chatReducer(state, { type: "appendAgentThought", text: "Thinking…" });
    expect(state.promptInFlight).toBe(true);
    expect(state.thoughtStartedAtMs).toBe(Date.now());

    state = chatReducer(state, { type: "stopTurn" });
    expect(state.promptInFlight).toBe(false);
    expect(state.thoughtStartedAtMs).toBeNull();
  });

  it("marks the agent disconnected, keeps the error, and logs the message in the trace", () => {
    const disconnectMessage =
      'Lost connection to ACP agent "Cursor".\nThe agent process exited with an error (code 1).\nSend a message to reconnect, or use /reset to start a new session.';
    let state = createInitialChatState();
    state = chatReducer(state, { type: "agentConnection", connected: true });
    state = chatReducer(state, {
      type: "error",
      message: disconnectMessage,
      disconnected: true,
    });
    expect(state.agentConnected).toBe(false);
    expect(state.errorText).toBe(disconnectMessage);
    expect(state.trace.at(-1)).toEqual({
      type: "agent",
      text: disconnectMessage,
    });
    state = chatReducer(state, { type: "submit", body: "retry" });
    expect(state.errorText).toBe(disconnectMessage);
    state = chatReducer(state, { type: "agentConnection", connected: true });
    expect(state.agentConnected).toBe(true);
    expect(state.errorText).toBeNull();
  });

  it("stops a live command when the connection stalls and keeps the agent connected", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let state = createInitialChatState();
    state = chatReducer(state, { type: "agentConnection", connected: true });
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "bash-1",
      title: "cmake --build build/debug --target nsmbu -j && nsmbu",
      kind: "execute",
      status: "in_progress",
    });
    vi.advanceTimersByTime(1_200);
    state = chatReducer(state, {
      type: "error",
      message: "The connection stalled. Send a message to continue.",
      stalled: true,
    });
    expect(state.agentConnected).toBe(true);
    expect(state.promptInFlight).toBe(false);
    expect(state.errorText).toBe("The connection stalled. Send a message to continue.");
    expect(state.trace.find((item) => item.type === "tool")).toMatchObject({
      status: "failed",
      durationMs: 1_200,
    });
    expect(state.trace.at(-1)).toEqual({
      type: "agent",
      text: "The connection stalled. Send a message to continue.",
    });
    state = chatReducer(state, { type: "submit", body: "continue" });
    expect(state.errorText).toBeNull();
    expect(state.agentConnected).toBe(true);
    vi.useRealTimers();
  });

  it("stops a running thought timer on error or disconnect", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let state = createInitialChatState();
    state = chatReducer(state, { type: "submit", body: "hi" });
    state = chatReducer(state, { type: "appendAgentThought", text: "Thinking…" });
    vi.advanceTimersByTime(800);
    state = chatReducer(state, {
      type: "error",
      message: "Agent process exited unexpectedly.",
    });
    expect(state.promptInFlight).toBe(false);
    expect(state.thoughtStartedAtMs).toBeNull();
    expect(state.trace[1]).toEqual({
      type: "thought",
      text: "Thinking…",
      durationMs: 800,
    });

    const startedAtMs = Date.now() - 2_500;
    state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      visibleTrace: [{ type: "thought", text: "Still thinking.", startedAtMs }],
    });
    state = chatReducer(state, {
      type: "error",
      message: "Agent process exited unexpectedly.",
    });
    expect(state.thoughtStartedAtMs).toBeNull();
    expect(state.trace[0]).toEqual({
      type: "thought",
      text: "Still thinking.",
      durationMs: 2_500,
    });

    state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      sessionHistoryLoading: true,
      visibleTrace: [{ type: "user", text: "hi" }],
    });
    state = chatReducer(state, { type: "appendUserText", text: "hi" });
    state = chatReducer(state, { type: "appendAgentThought", text: "Thinking…" });
    vi.advanceTimersByTime(500);
    state = chatReducer(state, {
      type: "error",
      message: "Agent process exited unexpectedly.",
    });
    state = chatReducer(state, { type: "sessionHistoryLoading", loading: false });
    expect(state.thoughtStartedAtMs).toBeNull();
    expect(state.trace[1]).toEqual({
      type: "thought",
      text: "Thinking…",
      durationMs: 500,
    });
  });

  it("records thought start time on the trace item so it can be saved", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let state = createInitialChatState();
    state = chatReducer(state, { type: "appendAgentThought", text: "Thinking…" });
    expect(state.trace[0]).toEqual({
      type: "thought",
      text: "Thinking…",
      startedAtMs: Date.now(),
    });
  });

  it("keeps a cached thought time on that thought when earlier replay thoughts exist", () => {
    const cached = [
      { type: "thought" as const, text: "Planning the change.", durationMs: 3200 },
    ];
    const replay = [
      { type: "thought" as const, text: "Earlier." },
      { type: "agent" as const, text: "ok" },
      { type: "thought" as const, text: "Planning the change." },
    ];
    expect(mergeThoughtDurationsFromCache(replay, cached)).toEqual([
      { type: "thought", text: "Earlier." },
      { type: "agent", text: "ok" },
      { type: "thought", text: "Planning the change.", durationMs: 3200 },
    ]);
  });

  it("restores saved thought times onto the agent transcript when load finishes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const cached = [
      { type: "thought" as const, text: "Planning the change.", durationMs: 3200 },
    ];
    let state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      sessionHistoryLoading: true,
      visibleTrace: cached,
      thoughtDurations: [900, 0, 3200],
    });
    state = chatReducer(state, { type: "appendAgentThought", text: "Earlier." });
    state = chatReducer(state, { type: "appendAgentText", text: "ok" });
    state = chatReducer(state, { type: "appendAgentThought", text: "Skipped." });
    state = chatReducer(state, { type: "appendAgentText", text: "next" });
    state = chatReducer(state, { type: "appendAgentThought", text: "Planning the change." });
    vi.advanceTimersByTime(40);
    state = chatReducer(state, { type: "appendAgentText", text: "Done" });
    state = chatReducer(state, { type: "sessionHistoryLoading", loading: false });
    expect(state.trace.filter((item) => item.type === "thought")).toEqual([
      { type: "thought", text: "Earlier.", durationMs: 900 },
      { type: "thought", text: "Skipped." },
      { type: "thought", text: "Planning the change.", durationMs: 3200 },
    ]);
    expect(state.thoughtDurations).toEqual([900, 0, 3200]);
  });

  it("merges cached thought durations onto agent replay when load finishes", () => {
    const cached = [
      { type: "user" as const, text: "hi" },
      { type: "thought" as const, text: "Thinking about hi.", durationMs: 1500 },
      { type: "agent" as const, text: "Hello" },
    ];
    let state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      sessionHistoryLoading: true,
      visibleTrace: cached,
    });
    state = chatReducer(state, { type: "appendUserText", text: "hi" });
    state = chatReducer(state, { type: "appendAgentThought", text: "Thinking about hi." });
    state = chatReducer(state, { type: "appendAgentText", text: "Hello" });
    state = chatReducer(state, { type: "sessionHistoryLoading", loading: false });
    expect(state.trace).toEqual([
      { type: "user", text: "hi" },
      { type: "thought", text: "Thinking about hi.", durationMs: 1500 },
      { type: "agent", text: "Hello" },
    ]);
  });

  it("merges cached command durations onto agent replay when load finishes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const cached = [
      { type: "user" as const, text: "list tests" },
      {
        type: "tool" as const,
        toolCallId: "exec1",
        title: "Terminal",
        kind: "execute",
        status: "completed" as const,
        subtitle: "ls -la tests",
        durationMs: 117,
      },
    ];
    let state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      sessionHistoryLoading: true,
      visibleTrace: cached,
    });
    state = chatReducer(state, { type: "appendUserText", text: "list tests" });
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "exec1",
      title: "Terminal",
      kind: "execute",
      status: "pending",
      subtitle: "ls -la tests",
    });
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId: "exec1",
      status: "completed",
    });
    state = chatReducer(state, { type: "sessionHistoryLoading", loading: false });
    const tool = state.trace[1];
    expect(tool?.type).toBe("tool");
    if (tool?.type !== "tool") {
      return;
    }
    expect(tool.durationMs).toBe(117);
  });

  it("keeps saved bash times when replay measures a shorter clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const cached = [
      {
        type: "tool" as const,
        toolCallId: "exec-late",
        title: "Terminal",
        kind: "execute",
        status: "completed" as const,
        subtitle: "echo late",
        durationMs: 2100,
      },
    ];
    let state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      sessionHistoryLoading: true,
      visibleTrace: cached,
      bashDurations: [
        { toolCallId: "exec-early", durationMs: 4500 },
        { toolCallId: "exec-late", durationMs: 2100 },
      ],
    });
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "exec-early",
      title: "Terminal",
      kind: "execute",
      status: "pending",
      subtitle: "echo early",
    });
    vi.advanceTimersByTime(40);
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId: "exec-early",
      status: "completed",
    });
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "exec-late",
      title: "Terminal",
      kind: "execute",
      status: "pending",
      subtitle: "echo late",
    });
    vi.advanceTimersByTime(40);
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId: "exec-late",
      status: "completed",
    });
    state = chatReducer(state, { type: "sessionHistoryLoading", loading: false });
    const tools = state.trace.filter((item) => item.type === "tool");
    expect(tools).toEqual([
      expect.objectContaining({ toolCallId: "exec-early", durationMs: 4500 }),
      expect.objectContaining({ toolCallId: "exec-late", durationMs: 2100 }),
    ]);
    expect(state.bashDurations).toEqual([
      { toolCallId: "exec-early", durationMs: 4500 },
      { toolCallId: "exec-late", durationMs: 2100 },
    ]);
  });

  it("ignores non-positive agent thought durations so client timing can run", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendAgentThought",
      text: "Thinking…",
      durationMs: 0,
    });
    expect(state.thoughtStartedAtMs).toBe(Date.now());
    vi.advanceTimersByTime(400);
    state = chatReducer(state, { type: "appendAgentText", text: "Answer" });
    const thought = state.trace[0];
    expect(thought?.type).toBe("thought");
    if (thought?.type !== "thought") {
      return;
    }
    expect(thought.durationMs).toBe(400);
  });

  it("stops a replayed thought clock when load finishes and the agent is idle", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      sessionHistoryLoading: true,
      visibleTrace: [{ type: "user", text: "hi" }],
    });
    state = chatReducer(state, {
      type: "appendAgentThought",
      text: "Rebuilding now to verify with logs.",
    });
    vi.advanceTimersByTime(155_100);
    expect(state.replayThoughtStartedAtMs).toBe(Date.parse("2026-01-01T00:00:00.000Z"));
    state = chatReducer(state, { type: "sessionHistoryLoading", loading: false });
    expect(state.thoughtStartedAtMs).toBeNull();
    expect(state.promptInFlight).toBe(false);
    expect(state.trace).toEqual([
      {
        type: "thought",
        text: "Rebuilding now to verify with logs.",
        durationMs: 155_100,
      },
    ]);
  });

  it("keeps the visible cache when load finishes with no replay", () => {
    let state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      sessionHistoryLoading: true,
      visibleTrace: [{ type: "user", text: "hi" }],
    });
    state = chatReducer(state, { type: "sessionHistoryLoading", loading: false });
    expect(state.trace).toEqual([{ type: "user", text: "hi" }]);
    expect(state.historyCommit).toBe(0);
  });

  it("seeds composer state from init cache without loading", () => {
    writeCachedSessionConfigOptions("cursor", [
      {
        configId: "model",
        name: "Model",
        category: "model",
        type: "select",
        currentValue: "claude-opus-4-8",
        options: [{ value: "claude-opus-4-8", name: "Opus 4.8" }],
      },
    ]);
    const state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "Chat",
      acpAgentName: "cursor",
      sessionConfigOptionsSeed: [
        {
          configId: "model",
          name: "Model",
          category: "model",
          type: "select",
          currentValue: "claude-opus-4-8",
          options: [{ value: "claude-opus-4-8", name: "Opus 4.8" }],
        },
      ],
    });
    expect(state.sessionConfigLoading).toBe(false);
    expect(state.sessionConfigOptions?.[0]?.currentValue).toBe("claude-opus-4-8");
  });

  it("seeds providers and recents from init and applies recents refreshes", () => {
    let state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "New Cursor chat",
      acpAgentName: "Cursor",
      providers: ["Cursor", "OpenCode"],
      recentSessions: [{ id: "s2", title: "Old chat", updatedAt: 5 }],
    });
    expect(state.sessionTitle).toBe("New Cursor chat");
    expect(state.providers).toEqual(["Cursor", "OpenCode"]);
    state = chatReducer(state, { type: "sessionTitle", title: "Fix login" });
    expect(state.sessionTitle).toBe("Fix login");
    expect(state.recentSessions).toEqual([{ id: "s2", title: "Old chat", updatedAt: 5 }]);
    state = chatReducer(state, {
      type: "recentSessions",
      sessions: [{ id: "s3", title: "Newer chat", updatedAt: 9 }],
    });
    expect(state.recentSessions).toEqual([{ id: "s3", title: "Newer chat", updatedAt: 9 }]);
    state = chatReducer(state, { type: "dismissRecentSession", sessionId: "s3" });
    expect(state.recentSessions).toEqual([]);
  });

  it("switches the agent only while the transcript is empty", () => {
    let state = createChatStateFromInit({
      type: "init",
      sessionId: "s1",
      title: "New Cursor chat",
      acpAgentName: "Cursor",
    });
    state = chatReducer(state, { type: "pickSessionAgent", agentName: "OpenCode" });
    expect(state.acpAgentSelection?.currentName).toBe("OpenCode");
    expect(state.sessionConfigOptions).toBeNull();
    expect(state.sessionConfigLoading).toBe(true);
    state = chatReducer(state, { type: "appendAgentText", text: "Hello" });
    state = chatReducer(state, { type: "pickSessionAgent", agentName: "Cursor" });
    expect(state.acpAgentSelection?.currentName).toBe("OpenCode");
  });

  it("keeps a subagent transcript separate and shows its status on the parent", () => {
    let state = createInitialChatState();
    state = chatReducer(state, { type: "appendAgentText", text: "Parent" });
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: "child-1",
      title: "Explore",
      description: "Find the login bug",
      state: "running",
    });
    state = chatReducer(state, {
      type: "subagentActivity",
      sessionId: "child-1",
      event: { type: "appendAgentText", text: "Looking" },
    });
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: "child-1",
      state: "idle",
      stopReason: "end_turn",
    });
    expect(state.trace[0]).toEqual({ type: "agent", text: "Parent" });
    expect(state.trace[1]).toMatchObject({
      type: "subagent",
      sessionId: "child-1",
      title: "Explore",
      description: "Find the login bug",
      state: "idle",
      stopReason: "end_turn",
    });
    expect(state.subagentActivity.get("child-1")?.trace).toEqual([
      { type: "agent", text: "Looking" },
    ]);
  });

  it("shows a background task as running and keeps its activity on that task", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "call-task-1",
      title: "Task: Verify sky banding",
      kind: "other",
      status: "pending",
      subtitle: "generalPurpose",
      content: "Capture the screenshot",
    });
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId: "call-task-1",
      status: "in_progress",
    });
    state = chatReducer(state, {
      type: "cursorTask",
      toolCallId: "call-task-1",
      description: "Verify sky banding",
      prompt: "Capture the screenshot",
      subagentType: "generalPurpose",
      durationMs: 866,
    });
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: "child-1",
      toolCallId: "call-task-1",
      title: "Verify sky banding",
      description: "Capture the screenshot",
      state: "running",
      stopReason: null,
    });
    state = chatReducer(state, {
      type: "subagentActivity",
      sessionId: "child-1",
      event: { type: "appendAgentText", text: "The sky still shows bands." },
    });
    const task = state.trace.find((item) => item.type === "tool");
    expect(task).toMatchObject({ status: "in_progress", durationMs: undefined });
    expect(state.trace.some((item) => item.type === "subagent")).toBe(false);
    expect(state.subagentActivity.get("child-1")?.trace).toEqual([
      { type: "agent", text: "The sky still shows bands." },
    ]);
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: "child-1",
      toolCallId: "call-task-1",
      state: "idle",
      stopReason: "end_turn",
    });
    expect(state.trace.find((item) => item.type === "tool")).toMatchObject({
      status: "completed",
    });
  });

  it("starts a live clock when a subagent task begins", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "call-task-1",
      title: "Task: Explore",
      kind: "other",
      status: "in_progress",
      subtitle: "explore",
      content: "Find the bug",
    });
    const task = state.trace[0];
    expect(task).toMatchObject({ type: "tool", startedAtMs: Date.now() });
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: "child-1",
      title: "Explore",
      state: "running",
    });
    expect(state.trace.find((item) => item.type === "subagent")).toMatchObject({
      startedAtMs: Date.now(),
    });
    vi.useRealTimers();
  });

  it("keeps live child updates on the task after cursor/task reports the agent id", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "call-task-1",
      title: "Task: Explore",
      kind: "other",
      status: "in_progress",
    });
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: "child.1",
      toolCallId: "call-task-1",
      title: "Explore",
      state: "running",
    });
    state = chatReducer(state, {
      type: "cursorTask",
      toolCallId: "call-task-1",
      description: "Explore",
      prompt: "Find the bug",
      subagentType: "explore",
      agentId: "child",
      durationMs: 40,
    });
    state = chatReducer(state, {
      type: "subagentActivity",
      sessionId: "child.1",
      event: { type: "appendAgentText", text: "Reading auth.ts" },
    });
    state = chatReducer(state, {
      type: "subagentActivity",
      sessionId: "child.1",
      event: {
        type: "appendToolCall",
        toolCallId: "call-read-1",
        title: "Read auth.ts",
        kind: "read",
        status: "in_progress",
      },
    });
    expect(state.trace.some((item) => item.type === "subagent")).toBe(false);
    const childTrace = state.subagentActivity.get("child.1")?.trace ?? [];
    expect(childTrace[0]).toMatchObject({ type: "agent", text: "Reading auth.ts" });
    expect(childTrace[1]).toMatchObject({
      type: "tool",
      toolCallId: "call-read-1",
      status: "in_progress",
    });
  });

  it("stops showing a linked task as running when its work state is unknown", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "call-task-1",
      title: "Task: Explore",
      kind: "other",
      status: "in_progress",
    });
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: "child-1",
      toolCallId: "call-task-1",
      state: "unknown",
    });
    expect(state.trace.find((item) => item.type === "tool")).toMatchObject({
      status: "in_progress",
      taskStopReason: "unknown",
    });
  });

  it("links a task to the Cursor agent id and drops the duplicate child row", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: "child-1",
      title: "Explore",
      state: "running",
    });
    state = chatReducer(state, {
      type: "cursorTask",
      toolCallId: "call-task-1",
      description: "Explore",
      prompt: "Find the bug",
      subagentType: "explore",
      agentId: "child-1",
    });
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: "child-1",
      toolCallId: "call-task-1",
    });
    state = chatReducer(state, {
      type: "subagentActivity",
      sessionId: "child-1",
      event: { type: "appendAgentText", text: "Found it" },
    });
    expect(state.trace.some((item) => item.type === "subagent")).toBe(false);
    expect(state.trace.some((item) => item.type === "tool")).toBe(true);
    expect(state.subagentActivity.get("child-1")?.trace).toEqual([
      { type: "agent", text: "Found it" },
    ]);
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId: "call-task-1",
      status: "completed",
    });
    expect(state.trace.find((item) => item.type === "tool")).toMatchObject({
      status: "completed",
    });
  });

  it("drops the blank subagent row once the task links that child", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "subagentActivity",
      sessionId: "child.1",
      event: { type: "appendAgentText", text: "Reading the menu" },
    });
    expect(state.trace.filter((item) => item.type === "subagent")).toHaveLength(1);
    state = chatReducer(state, {
      type: "cursorTask",
      toolCallId: "call-task-1",
      description: "Decompile open menu",
      prompt: "Write the declaration",
      subagentType: "generalPurpose",
      agentId: "child",
    });
    expect(state.trace.some((item) => item.type === "subagent")).toBe(false);
    expect(state.trace.find((item) => item.type === "tool")).toMatchObject({
      title: "Task: Decompile open menu",
      status: "in_progress",
    });
    state = chatReducer(state, {
      type: "subagentActivity",
      sessionId: "child.1",
      event: { type: "appendAgentText", text: "Still reading" },
    });
    expect(state.trace.filter((item) => item.type === "subagent")).toHaveLength(0);
  });

  it("places a nested child inside its parent", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: "child",
      title: "Parent worker",
      state: "running",
    });
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: "grandchild",
      title: "Nested",
      state: "running",
      parentSessionId: "child",
    });
    expect(state.trace.filter((item) => item.type === "subagent")).toHaveLength(1);
    expect(state.subagentActivity.get("child")?.trace[0]).toMatchObject({
      type: "subagent",
      sessionId: "grandchild",
      title: "Nested",
    });
  });

  it("drops duplicate subagent rows after parallel Cursor tasks complete", () => {
    const tasks = [
      {
        tool: "call-e44cf5b4-e74b-4ffd-921c-d9f978c8c887-238\nfc_258cd7aa-21ea-9c27-ba48-60cf574bb93b_2",
        sid: "6713a299-4a13-4f31-842e-818ace8f882c",
        desc: "CLI skill log trial",
      },
      {
        tool: "call-e44cf5b4-e74b-4ffd-921c-d9f978c8c887-239\nfc_258cd7aa-21ea-9c27-ba48-60cf574bb93b_3",
        sid: "23558938-4415-48a9-9b0c-fd7f024cd619",
        desc: "CLI skill screen trial",
      },
      {
        tool: "call-e44cf5b4-e74b-4ffd-921c-d9f978c8c887-240\nfc_258cd7aa-21ea-9c27-ba48-60cf574bb93b_4",
        sid: "29351b51-4a3f-4bc9-bc3c-d70175ba370e",
        desc: "CLI skill warm-build trial",
      },
    ] as const;
    let state = createInitialChatState();
    for (const task of tasks) {
      const toolCallId = canonicalToolCallId(task.tool);
      state = chatReducer(state, {
        type: "appendToolCall",
        toolCallId,
        title: `Task: ${task.desc}`,
        kind: "other",
        status: "pending",
        subtitle: "generalPurpose",
        content: "prompt",
      });
      state = chatReducer(state, {
        type: "updateToolCall",
        toolCallId,
        status: "in_progress",
      });
      const spawned = cursorSubagentUpdateMessage({
        sessionUpdate: "subagent_spawned",
        subagentSessionId: task.sid,
        name: "generalPurpose",
        task: "Follow skill",
        _meta: { cursor: { toolCallId: task.tool, agentId: task.sid } },
      } as never);
      expect(spawned).toBeDefined();
      state = chatReducer(state, spawned! as ChatAction);
      state = chatReducer(state, {
        type: "subagentActivity",
        sessionId: task.sid,
        event: { type: "appendAgentText", text: `Working on ${task.desc}` },
      });
    }
    for (const task of tasks) {
      const completed = cursorSubagentUpdateMessage({
        sessionUpdate: "subagent_state_update",
        subagentSessionId: task.sid,
        state: "completed",
        _meta: { cursor: { toolCallId: task.tool, agentId: task.sid } },
      } as never);
      expect(completed).toBeDefined();
      state = chatReducer(state, completed! as ChatAction);
      state = chatReducer(state, {
        type: "updateToolCall",
        toolCallId: canonicalToolCallId(task.tool),
        status: "completed",
        content: JSON.stringify({ durationMs: 1000 }),
      });
      state = chatReducer(state, {
        type: "cursorTask",
        toolCallId: task.tool,
        description: task.desc,
        prompt: "prompt",
        subagentType: "generalPurpose",
        agentId: task.sid,
        durationMs: 1000,
      });
    }
    for (const item of state.trace) {
      if (item.type !== "subagent") continue;
      expect(
        traceCoversSubagentSession(state.trace, state.subagentSessionByToolId, item.sessionId),
      ).toBe(true);
      expect(item.state).not.toBe("running");
    }
    expect(state.trace.filter((item) => item.type === "subagent")).toHaveLength(0);
  });

  it("drops the placeholder subagent row when activity beats subagent_spawned", () => {
    const tool =
      "call-e44cf5b4-e74b-4ffd-921c-d9f978c8c887-238\nfc_258cd7aa-21ea-9c27-ba48-60cf574bb93b_2";
    const sid = "6713a299-4a13-4f31-842e-818ace8f882c";
    const toolCallId = canonicalToolCallId(tool);
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId,
      title: "Task: CLI skill log trial",
      kind: "other",
      status: "in_progress",
      subtitle: "generalPurpose",
      content: "prompt",
    });
    state = chatReducer(state, {
      type: "subagentActivity",
      sessionId: sid,
      event: { type: "appendAgentText", text: "Working" },
    });
    expect(state.trace.filter((item) => item.type === "subagent")).toHaveLength(1);
    const spawned = cursorSubagentUpdateMessage({
      sessionUpdate: "subagent_spawned",
      subagentSessionId: sid,
      name: "generalPurpose",
      task: "Follow skill",
      _meta: { cursor: { toolCallId: tool, agentId: sid } },
    } as never);
    state = chatReducer(state, spawned! as ChatAction);
    expect(state.trace.filter((item) => item.type === "subagent")).toHaveLength(0);
    const completed = cursorSubagentUpdateMessage({
      sessionUpdate: "subagent_state_update",
      subagentSessionId: sid,
      state: "completed",
      _meta: { cursor: { toolCallId: tool, agentId: sid } },
    } as never);
    state = chatReducer(state, completed! as ChatAction);
    expect(state.trace.find((item) => item.type === "tool")).toMatchObject({ status: "completed" });
    expect(state.trace.filter((item) => item.type === "subagent")).toHaveLength(0);
  });

  it("does not resurrect a running placeholder after the linked task completes", () => {
    const tool =
      "call-e44cf5b4-e74b-4ffd-921c-d9f978c8c887-239\nfc_258cd7aa-21ea-9c27-ba48-60cf574bb93b_3";
    const sid = "23558938-4415-48a9-9b0c-fd7f024cd619";
    const toolCallId = canonicalToolCallId(tool);
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId,
      title: "Task: CLI skill screen trial",
      kind: "other",
      status: "in_progress",
      subtitle: "generalPurpose",
      content: "prompt",
    });
    const spawned = cursorSubagentUpdateMessage({
      sessionUpdate: "subagent_spawned",
      subagentSessionId: sid,
      name: "generalPurpose",
      task: "Follow skill",
      _meta: { cursor: { toolCallId: tool, agentId: sid } },
    } as never);
    state = chatReducer(state, spawned! as ChatAction);
    const completed = cursorSubagentUpdateMessage({
      sessionUpdate: "subagent_state_update",
      subagentSessionId: sid,
      state: "completed",
      _meta: { cursor: { toolCallId: tool, agentId: sid } },
    } as never);
    state = chatReducer(state, completed! as ChatAction);
    state = chatReducer(state, {
      type: "subagentActivity",
      sessionId: sid,
      event: { type: "appendAgentText", text: "Late chunk" },
    });
    expect(state.trace.filter((item) => item.type === "subagent")).toHaveLength(0);
    expect(state.trace.find((item) => item.type === "tool")).toMatchObject({ status: "completed" });
  });

  it("prunes a placeholder subagent row once the task card covers that session", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId: "call-map-task",
      title: "Task: Map return root cause",
      kind: "other",
      status: "in_progress",
      subtitle: "generalPurpose",
      content: "prompt",
    });
    state = {
      ...state,
      trace: [
        ...state.trace,
        {
          type: "subagent",
          sessionId: "child",
          title: "Subagent",
          description: "",
          state: "running",
          stopReason: null,
          startedAtMs: Date.now(),
        },
      ],
      subagentSessionByToolId: new Map([["call-map-task", "child"]]),
    };
    state = chatReducer(state, {
      type: "subagentActivity",
      sessionId: "child",
      event: { type: "appendAgentText", text: "Still investigating" },
    });
    expect(state.trace.filter((item) => item.type === "subagent")).toHaveLength(0);
    expect(state.trace.find((item) => item.type === "tool")).toMatchObject({
      title: "Task: Map return root cause",
      status: "in_progress",
    });
  });

  it("shows one openable task card for a Cursor child session", () => {
    const tool =
      "call-d2f4206e-da79-4b84-9e49-75cc1a738982-94\nfc_8427ff20-9572-4d84-a243-78b827807b83_2";
    const sid = "0ec8e1e2-3379-40bc-8507-171683fa821b";
    const toolCallId = canonicalToolCallId(tool);
    const spawnLine = JSON.stringify({
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId: "parent",
        update: {
          sessionUpdate: "subagent_spawned",
          subagentSessionId: sid,
          name: "generalPurpose",
          task: "Map castle cannon crash",
          _meta: { cursor: { toolCallId: tool, agentId: sid } },
        },
      },
    });
    const doneLine = JSON.stringify({
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId: "parent",
        update: {
          sessionUpdate: "subagent_state_update",
          subagentSessionId: sid,
          state: "completed",
          _meta: { cursor: { toolCallId: tool, agentId: sid } },
        },
      },
    });
    let state = chatReducer(createInitialChatState(), {
      type: "appendToolCall",
      toolCallId,
      title: "Task: Map castle cannon crash",
      kind: "other",
      status: "pending",
      content: "Map the crash",
    });
    state = chatReducer(state, {
      type: "subagentActivity",
      sessionId: sid,
      event: { type: "appendAgentText", text: "Looking at the cannon" },
    });
    const spawned = cursorSubagentUpdateMessage(
      cursorChildSessionNotificationFromLine(spawnLine)?.update,
    );
    expect(spawned?.type).toBe("subagentUpdate");
    if (spawned?.type !== "subagentUpdate") {
      return;
    }
    state = chatReducer(state, spawned);
    expect(state.trace.filter((item) => item.type === "subagent")).toHaveLength(0);
    expect(state.trace.filter((item) => item.type === "tool")).toHaveLength(1);
    expect(state.subagentActivity.get(sid)?.trace).toEqual([
      { type: "agent", text: "Looking at the cannon" },
    ]);
    const completed = cursorSubagentUpdateMessage(
      cursorChildSessionNotificationFromLine(doneLine)?.update,
    );
    if (completed?.type !== "subagentUpdate") {
      throw new Error("missing completion");
    }
    state = chatReducer(state, completed);
    expect(state.trace.filter((item) => item.type === "subagent")).toHaveLength(0);
    expect(state.trace.find((item) => item.type === "tool")).toMatchObject({
      toolCallId,
      status: "completed",
    });
  });

  it("keeps the spawn session id when cursor/task reports a different agentId", () => {
    const tool =
      "call-e44cf5b4-e74b-4ffd-921c-d9f978c8c887-239\nfc_258cd7aa-21ea-9c27-ba48-60cf574bb93b_3";
    const spawnId = "23558938-4415-48a9-9b0c-fd7f024cd619";
    const taskAgentId = "4edb31e4-726d-4645-b763-676b67e69871";
    const toolCallId = canonicalToolCallId(tool);
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "appendToolCall",
      toolCallId,
      title: "Task: CLI skill screen trial",
      kind: "other",
      status: "in_progress",
      subtitle: "generalPurpose",
      content: "prompt",
    });
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: spawnId,
      toolCallId: tool,
      title: "generalPurpose",
      state: "running",
    });
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: spawnId,
      toolCallId: tool,
      state: "idle",
      stopReason: "end_turn",
    });
    state = chatReducer(state, {
      type: "updateToolCall",
      toolCallId,
      status: "completed",
      content: JSON.stringify({ durationMs: 82844 }),
    });
    state = chatReducer(state, {
      type: "cursorTask",
      toolCallId: tool,
      description: "CLI skill screen trial",
      prompt: "prompt",
      subagentType: "generalPurpose",
      agentId: taskAgentId,
      durationMs: 82844,
    });
    state = chatReducer(state, {
      type: "subagentActivity",
      sessionId: spawnId,
      event: { type: "appendAgentText", text: "Late chunk on the real child" },
    });
    expect(state.subagentSessionByToolId.get(toolCallId)).toBe(spawnId);
    expect(state.trace.filter((item) => item.type === "subagent")).toHaveLength(0);
    for (const item of state.trace) {
      if (item.type !== "subagent") continue;
      expect(traceCoversSubagentSession(state.trace, state.subagentSessionByToolId, item.sessionId)).toBe(
        true,
      );
    }
  });

  it("marks a running child unknown after the agent disconnects", () => {
    let state = createInitialChatState();
    state = chatReducer(state, {
      type: "subagentUpdate",
      sessionId: "child-1",
      title: "Explore",
      state: "running",
    });
    state = chatReducer(state, {
      type: "error",
      message: "Agent exited",
      disconnected: true,
    });
    expect(state.trace.find((item) => item.type === "subagent")).toMatchObject({
      state: "unknown",
    });
  });
});
