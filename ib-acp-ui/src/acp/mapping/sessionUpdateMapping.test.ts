import { describe, expect, it } from "vite-plus/test";
import { canonicalToolCallId } from "./canonicalToolCallId";
import {
    createToolCallKindTracking,
    cursorSubagentUpdateMessage,
    extensionMessagesForPermissionRequest,
    messagesForSessionNotification,
    searchStatsSubtitleFromRawOutput,
    sessionUpdateToWebviewMessages,
    toolCallUpdateSubtitleHint,
} from "./sessionUpdateMapping";

describe("sessionUpdateToWebviewMessages", () => {
    it("maps user_message_chunk to appendUserText", () => {
        const messages = sessionUpdateToWebviewMessages({
            sessionUpdate: "user_message_chunk",
            content: { type: "text", text: "hello" },
        });
        expect(messages).toEqual([{ type: "appendUserText", text: "hello" }]);
    });

    it("maps a user image chunk to appendUserImage", () => {
        const messages = sessionUpdateToWebviewMessages({
            sessionUpdate: "user_message_chunk",
            content: { type: "image", data: "QUJD", mimeType: "image/png" },
        });
        expect(messages).toEqual([
            { type: "appendUserImage", image: { data: "QUJD", mimeType: "image/png" } },
        ]);
    });

    it("maps usage_update to tokenUsage", () => {
        const messages = sessionUpdateToWebviewMessages({
            sessionUpdate: "usage_update",
            used: 12345,
            size: 200000,
        });
        expect(messages).toEqual([{ type: "tokenUsage", used: 12345, size: 200000 }]);
    });

    it("maps agent_thought_chunk duration from _meta when top-level duration is absent", () => {
        const messages = sessionUpdateToWebviewMessages({
            sessionUpdate: "agent_thought_chunk",
            content: { type: "text", text: "hmm" },
            _meta: { duration_ms: 890 },
        } as never);
        expect(messages).toEqual([{ type: "appendAgentThought", text: "hmm", durationMs: 890 }]);
    });

    it("omits exit 0 from shell rawOutput content", () => {
        const tracking = createToolCallKindTracking();
        sessionUpdateToWebviewMessages(
            {
                sessionUpdate: "tool_call",
                toolCallId: "bash-1",
                title: "Terminal",
                kind: "execute",
                status: "pending",
                rawInput: { command: "npm test" },
            },
            tracking,
        );
        const messages = sessionUpdateToWebviewMessages(
            {
                sessionUpdate: "tool_call_update",
                toolCallId: "bash-1",
                status: "completed",
                rawOutput: { exitCode: 0, stdout: "PASS\n" },
            },
            tracking,
        );
        expect(messages).toEqual([
            {
                type: "updateToolCall",
                toolCallId: "bash-1",
                status: "completed",
                content: "PASS",
            },
        ]);
    });

    it("keeps a non-zero exit code in shell rawOutput content", () => {
        const tracking = createToolCallKindTracking();
        sessionUpdateToWebviewMessages(
            {
                sessionUpdate: "tool_call",
                toolCallId: "bash-2",
                title: "Terminal",
                kind: "execute",
                status: "pending",
                rawInput: { command: "npm test" },
            },
            tracking,
        );
        const messages = sessionUpdateToWebviewMessages(
            {
                sessionUpdate: "tool_call_update",
                toolCallId: "bash-2",
                status: "failed",
                rawOutput: { exitCode: 1, stdout: "", stderr: "FAIL src/foo.test.ts\n" },
            },
            tracking,
        );
        expect(messages).toEqual([
            {
                type: "updateToolCall",
                toolCallId: "bash-2",
                status: "failed",
                content: "exit 1\nFAIL src/foo.test.ts",
            },
        ]);
    });

    it("maps tool_call_update duration from _meta", () => {
        const messages = sessionUpdateToWebviewMessages({
            sessionUpdate: "tool_call_update",
            toolCallId: "tool_exec_1",
            status: "completed",
            _meta: { durationMs: 117 },
        } as never);
        expect(messages).toEqual([
            {
                type: "updateToolCall",
                toolCallId: "tool_exec_1",
                status: "completed",
                durationMs: 117,
            },
        ]);
    });

    it("derives grep match counts from Cursor-style rawOutput", () => {
        expect(
            searchStatsSubtitleFromRawOutput({
                totalMatches: 2,
                truncated: false,
            }),
        ).toBe("2 matches");
        expect(
            searchStatsSubtitleFromRawOutput({
                totalFiles: 209,
                truncated: false,
            }),
        ).toBe("209 files");
    });

    it("maps sparse Cursor grep completion to subtitle with match count", () => {
        const tracking = createToolCallKindTracking();
        sessionUpdateToWebviewMessages(
            {
                sessionUpdate: "tool_call",
                toolCallId: "tool_a471658c",
                title: "grep",
                kind: "search",
                status: "pending",
                rawInput: {},
            },
            tracking,
        );
        const messages = sessionUpdateToWebviewMessages(
            {
                sessionUpdate: "tool_call_update",
                toolCallId: "tool_a471658c",
                status: "completed",
                rawOutput: { totalMatches: 2, truncated: false },
            },
            tracking,
        );
        expect(messages).toEqual([
            {
                type: "updateToolCall",
                toolCallId: "tool_a471658c",
                status: "completed",
                subtitle: "2 matches",
            },
        ]);
    });

    it("keeps the grep pattern when a completion also reports a match count", () => {
        const hint = toolCallUpdateSubtitleHint({
            toolCallId: "tool_grep",
            status: "completed",
            kind: "search",
            rawInput: {
                pattern: "createChatStateFromInit",
                path: "webview/acp-ui/src/chatReducer.test.ts",
            },
            rawOutput: { totalMatches: 2, truncated: false },
        });
        expect(hint).toBe(
            '"createChatStateFromInit" in webview/acp-ui/src/chatReducer.test.ts · 2 matches',
        );
    });

    it("formats grep hits instead of a bare match count", () => {
        const messages = sessionUpdateToWebviewMessages({
            sessionUpdate: "tool_call_update",
            toolCallId: "tool_grep_hits",
            status: "completed",
            kind: "search",
            rawInput: { pattern: "plan", path: "src" },
            rawOutput: {
                totalMatches: 1,
                matches: [{ file: "src/plan.md", line: 4, text: "Open plan" }],
            },
        } as never);
        expect(messages[0]).toMatchObject({
            type: "updateToolCall",
            subtitle: '"plan" in src · 1 match',
            content: "src/plan.md:4: Open plan",
        });
    });

    it("extracts path from Cursor-style search error rawOutput", () => {
        const hint = toolCallUpdateSubtitleHint({
            toolCallId: "tool_4298cf79",
            status: "completed",
            kind: "search",
            rawOutput: {
                error: "Path does not exist: /home/econn/.cursor/projects/home-econn-git-vscode-acp-ui-docs/agent-transcripts",
            },
        });
        expect(hint).toBe(
            "/home/econn/.cursor/projects/home-econn-git-vscode-acp-ui-docs/agent-transcripts",
        );
    });

    it("derives pattern and path subtitles from structured rawInput", () => {
        const hint = toolCallUpdateSubtitleHint({
            toolCallId: "tool_grep",
            status: "completed",
            kind: "search",
            rawInput: {
                pattern: "createChatStateFromInit",
                path: "webview/acp-ui/src/chatReducer.test.ts",
            },
        });
        expect(hint).toBe('"createChatStateFromInit" in webview/acp-ui/src/chatReducer.test.ts');
    });

    it("maps Cursor-style completed edit update to diffRows and path subtitle", () => {
        const multilineId =
            "call-c4d9d88d-ab6e-48ed-9ff3-5425c287173c-4\nfc_p5fq8ry-6jKPYy-8ee7667a-aws_ue1_0";
        const messages = sessionUpdateToWebviewMessages({
            sessionUpdate: "tool_call_update",
            toolCallId: multilineId,
            status: "completed",
            content: [
                {
                    type: "diff",
                    path: "/home/econn/git/irishbruse-utilities/docs/test.md",
                    oldText: "# Test\nold\n",
                    newText: "# Test\nnew\n",
                },
            ],
        });
        expect(messages).toHaveLength(1);
        const msg = messages[0];
        expect(msg?.type).toBe("updateToolCall");
        if (msg?.type !== "updateToolCall") {
            return;
        }
        expect(msg.toolCallId).toBe(canonicalToolCallId(multilineId));
        expect(msg.subtitle).toBe("/home/econn/git/irishbruse-utilities/docs/test.md");
        expect(msg.diffRows).toBeDefined();
        expect(msg.diffRows!.length).toBeGreaterThan(0);
        expect(msg.diffRows!.some((row) => row.kind === "removed" || row.kind === "added")).toBe(
            true,
        );
    });

    it("maps a Cursor task tool call to the subagent type and prompt, not raw argument JSON", () => {
        const prompt =
            "Decompile cursor Back call\nReturn the declaration, the body, and a short description of what value 2 does to the cursor.";
        const rawInput = {
            _toolName: "task",
            prompt,
            description: "Decompile cursor Back call",
            subagentType: "generalPurpose",
        };
        const tracking = createToolCallKindTracking();
        const started = sessionUpdateToWebviewMessages(
            {
                sessionUpdate: "tool_call",
                toolCallId: "call-task-1",
                title: "Task: Decompile cursor Back call",
                kind: "other",
                status: "pending",
                rawInput,
            },
            tracking,
        );
        expect(started).toEqual([
            {
                type: "appendToolCall",
                toolCallId: "call-task-1",
                title: "Task: Decompile cursor Back call",
                kind: "other",
                status: "pending",
                subtitle: "generalPurpose",
                content: prompt,
            },
        ]);
        const finished = sessionUpdateToWebviewMessages(
            {
                sessionUpdate: "tool_call_update",
                toolCallId: "call-task-1",
                status: "completed",
                rawOutput: { durationMs: 1200, isBackground: false },
            },
            tracking,
        );
        expect(finished).toEqual([
            {
                type: "updateToolCall",
                toolCallId: "call-task-1",
                status: "completed",
                subtitle: "generalPurpose",
                durationMs: 1200,
            },
        ]);
        const dumped = JSON.stringify(finished);
        expect(dumped).not.toContain('"_toolName"');
        expect(dumped).not.toContain('"description"');
        expect(dumped).not.toContain("isBackground");
        const background = sessionUpdateToWebviewMessages(
            {
                sessionUpdate: "tool_call_update",
                toolCallId: "call-task-1",
                status: "disconnected" as "completed",
                rawOutput: { durationMs: 866, isBackground: true },
            },
            tracking,
        );
        expect(background).toEqual([
            {
                type: "updateToolCall",
                toolCallId: "call-task-1",
                status: "in_progress",
                subtitle: "generalPurpose",
            },
        ]);
    });

    it("forwards permission toolCall diff content as updateToolCall", () => {
        const messages = extensionMessagesForPermissionRequest("perm-1", {
            sessionId: "sess-1",
            toolCall: {
                toolCallId: "call-edit-1\nfc_extra",
                kind: "edit",
                title: "Write File",
                status: "pending",
                content: [
                    {
                        type: "diff",
                        path: "docs/test.md",
                        oldText: "a\n",
                        newText: "b\n",
                    },
                ],
            },
            options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
        });
        expect(messages[0]).toMatchObject({
            type: "permissionRequest",
            toolTitle: "Write File",
            detail: "docs/test.md",
            summary: "1 line(s) before -> 1 line(s) after",
        });
        if (messages[0]?.type === "permissionRequest") {
            expect(messages[0].diffRows?.some((row) => row.kind === "added")).toBe(true);
        }
        const update = messages.find((m) => m.type === "updateToolCall");
        expect(update).toBeDefined();
        if (update?.type !== "updateToolCall") {
            return;
        }
        expect(update.toolCallId).toBe("call-edit-1");
        expect(update.kind).toBe("edit");
        expect(update.subtitle).toBe("docs/test.md");
        expect(update.diffRows).toBeDefined();
        expect(update.diffRows!.length).toBeGreaterThan(0);
    });
});

describe("cursorSubagentUpdateMessage", () => {
    it("keeps a spawned background subagent running and links its tool", () => {
        expect(
            cursorSubagentUpdateMessage({
                sessionUpdate: "subagent_spawned",
                subagentSessionId: "child-1",
                name: "Verify sky banding",
                task: "Capture the screenshot",
                _meta: { cursor: { toolCallId: "call-task-1", agentId: "child-1" } },
            } as never),
        ).toEqual({
            type: "subagentUpdate",
            sessionId: "child-1",
            title: "Verify sky banding",
            description: "Capture the screenshot",
            state: "running",
            stopReason: null,
            toolCallId: "call-task-1",
        });
        expect(
            cursorSubagentUpdateMessage({
                sessionUpdate: "subagent_state_update",
                subagentSessionId: "child-1",
                state: "disconnected",
                _meta: { cursor: { toolCallId: "call-task-1", agentId: "child-1" } },
            } as never),
        ).toMatchObject({ state: "running", stopReason: null });
        expect(
            cursorSubagentUpdateMessage({
                sessionUpdate: "subagent_state_update",
                subagentSessionId: "child-1",
                state: "completed",
            } as never),
        ).toMatchObject({ state: "idle", stopReason: "end_turn" });
    });
});

describe("messagesForSessionNotification", () => {
    it("announces a child session on the parent", () => {
        expect(
            messagesForSessionNotification(
                {
                    sessionId: "parent",
                    update: {
                        sessionUpdate: "subagent_update",
                        sessionId: "child",
                        title: "Explore",
                        state: { state: "running" },
                    },
                },
                "parent",
                createToolCallKindTracking(),
            ),
        ).toEqual([
            {
                type: "subagentUpdate",
                sessionId: "child",
                title: "Explore",
                state: "running",
                stopReason: null,
            },
        ]);
    });

    it("routes a child message into that child session", () => {
        expect(
            messagesForSessionNotification(
                {
                    sessionId: "child",
                    update: {
                        sessionUpdate: "agent_message_chunk",
                        content: { type: "text", text: "Found it" },
                    },
                },
                "parent",
                createToolCallKindTracking(),
            ),
        ).toEqual([
            {
                type: "subagentActivity",
                sessionId: "child",
                event: { type: "appendAgentText", text: "Found it" },
            },
        ]);
    });

    it("keeps a session message on the child that received it", () => {
        expect(
            messagesForSessionNotification(
                {
                    sessionId: "child",
                    update: {
                        sessionUpdate: "session_message",
                        messageId: "msg-1",
                        senderSessionId: "parent",
                        content: [{ type: "text", text: "Find the bug" }],
                    },
                },
                "parent",
                createToolCallKindTracking(),
            ),
        ).toEqual([
            {
                type: "subagentActivity",
                sessionId: "child",
                event: { type: "appendAgentText", text: "Find the bug" },
            },
        ]);
    });

    it("applies a child state_update to that child", () => {
        expect(
            messagesForSessionNotification(
                {
                    sessionId: "child",
                    update: {
                        sessionUpdate: "state_update",
                        state: "unknown",
                    },
                } as never,
                "parent",
                createToolCallKindTracking(),
            ),
        ).toEqual([
            {
                type: "subagentUpdate",
                sessionId: "child",
                state: "unknown",
                stopReason: null,
            },
        ]);
    });

    it("nests a grandchild under the child that announced it", () => {
        expect(
            messagesForSessionNotification(
                {
                    sessionId: "child",
                    update: {
                        sessionUpdate: "subagent_update",
                        sessionId: "grandchild",
                        title: "Nested",
                        state: { state: "running" },
                    },
                },
                "parent",
                createToolCallKindTracking(),
            ),
        ).toEqual([
            {
                type: "subagentUpdate",
                sessionId: "grandchild",
                title: "Nested",
                state: "running",
                stopReason: null,
                parentSessionId: "child",
            },
        ]);
    });

    it("links a tool call to a session content block", () => {
        const messages = sessionUpdateToWebviewMessages({
            sessionUpdate: "tool_call_update",
            toolCallId: "call-wait-1",
            status: "in_progress",
            content: [{ type: "session", sessionId: "child-1" }],
        } as never);
        expect(messages).toContainEqual({
            type: "subagentUpdate",
            sessionId: "child-1",
            toolCallId: "call-wait-1",
        });
    });
});

describe("canonicalToolCallId", () => {
    it("keeps the first line of a Cursor multi-line toolCallId", () => {
        expect(
            canonicalToolCallId(
                "call-c4d9d88d-ab6e-48ed-9ff3-5425c287173c-4\nfc_p5fq8ry-6jKPYy-8ee7667a-aws_ue1_0",
            ),
        ).toBe("call-c4d9d88d-ab6e-48ed-9ff3-5425c287173c-4");
    });
});
