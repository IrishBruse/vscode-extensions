import { describe, expect, it } from "vite-plus/test";
import {
    acpSessionUpdateTitle,
    acpThoughtChunkPreview,
    formatAcpRpcDisplay,
    groupAcpRpcLogEntries,
    isAgentThoughtChunkLine,
    prettyPrintAcpRpcJson,
    type AcpRpcLogEntry,
} from "./acpRpcLog";

describe("acpSessionUpdateTitle", () => {
    it("uses the tool title for tool_call updates", () => {
        expect(
            acpSessionUpdateTitle({
                sessionUpdate: "tool_call",
                title: "Read File",
                kind: "read",
            }),
        ).toBe("tool_call · Read File");
    });

    it("previews streamed message text", () => {
        expect(
            acpSessionUpdateTitle({
                sessionUpdate: "agent_message_chunk",
                content: { type: "text", text: "Hello there" },
            }),
        ).toBe("agent_message_chunk · Hello there");
    });

    it("uses session_info_update title", () => {
        expect(
            acpSessionUpdateTitle({
                sessionUpdate: "session_info_update",
                title: "Fix login flow",
            }),
        ).toBe("session_info_update · Fix login flow");
    });

    it("omits thought content from the collapsed title", () => {
        expect(
            acpSessionUpdateTitle({
                sessionUpdate: "agent_thought_chunk",
                content: { type: "text", text: "Planning the refactor" },
            }),
        ).toBe("agent_thought_chunk");
    });
});

describe("formatAcpRpcDisplay", () => {
    it("hides jsonrpc, lifts id to rpcId, and splits session update from params", () => {
        const line = JSON.stringify({
            jsonrpc: "2.0",
            method: "session/update",
            id: 12,
            params: {
                sessionId: "s1",
                update: {
                    sessionUpdate: "agent_message_chunk",
                    content: { type: "text", text: "hi" },
                },
            },
        });
        expect(formatAcpRpcDisplay(line)).toEqual({
            title: "agent_message_chunk · hi",
            rpcId: "12",
            sessionUpdate: "agent_message_chunk",
            defaultCollapsed: true,
            fields: [
                { label: "method", kind: "scalar", value: "session/update" },
                {
                    label: "params",
                    kind: "json",
                    value: ["{", '  "sessionId": "s1"', "}"].join("\n"),
                },
                {
                    label: "update",
                    kind: "json",
                    value: [
                        "{",
                        '  "sessionUpdate": "agent_message_chunk",',
                        '  "content": {',
                        '    "type": "text",',
                        '    "text": "hi"',
                        "  }",
                        "}",
                    ].join("\n"),
                },
            ],
        });
    });

    it("surfaces tool_call titles in the entry summary", () => {
        const line = JSON.stringify({
            jsonrpc: "2.0",
            method: "session/update",
            params: {
                sessionId: "s1",
                update: {
                    sessionUpdate: "tool_call",
                    toolCallId: "tool-1",
                    title: "Write File",
                    kind: "edit",
                },
            },
        });
        expect(formatAcpRpcDisplay(line)).toMatchObject({
            title: "tool_call · Write File",
            sessionUpdate: "tool_call",
        });
    });

    it("lifts id to rpcId and omits jsonrpc from fields for responses", () => {
        const line = JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            result: { protocolVersion: 1 },
        });
        expect(formatAcpRpcDisplay(line)).toEqual({
            title: "response",
            rpcId: "3",
            defaultCollapsed: true,
            fields: [
                {
                    label: "result",
                    kind: "json",
                    value: ["{", '  "protocolVersion": 1', "}"].join("\n"),
                },
            ],
        });
    });

    it("marks agent_thought_chunk rows collapsed by default", () => {
        const line = JSON.stringify({
            jsonrpc: "2.0",
            method: "session/update",
            params: {
                sessionId: "s1",
                update: {
                    sessionUpdate: "agent_thought_chunk",
                    content: { type: "text", text: "Hidden in the header" },
                },
            },
        });
        expect(formatAcpRpcDisplay(line)).toMatchObject({
            title: "agent_thought_chunk",
            sessionUpdate: "agent_thought_chunk",
            defaultCollapsed: true,
        });
    });

    it("returns raw text when JSON parsing fails", () => {
        expect(formatAcpRpcDisplay("not-json")).toEqual({ raw: "not-json" });
    });
});

const thoughtLine = (text: string): string =>
    JSON.stringify({
        jsonrpc: "2.0",
        method: "session/update",
        params: {
            sessionId: "s1",
            update: {
                sessionUpdate: "agent_thought_chunk",
                content: { type: "text", text },
            },
        },
    });

function rpcEntry(id: number, raw: string): AcpRpcLogEntry {
    return { id, direction: "fromAgent", agentName: "Cursor", raw };
}

describe("groupAcpRpcLogEntries", () => {
    it("groups consecutive thought chunks", () => {
        const entries = [
            rpcEntry(1, thoughtLine("The")),
            rpcEntry(2, thoughtLine("user")),
            rpcEntry(3, thoughtLine("asked")),
        ];
        expect(groupAcpRpcLogEntries(entries)).toEqual([
            {
                kind: "thoughtGroup",
                groupKey: "thought-1",
                entries,
            },
        ]);
    });

    it("keeps a lone thought chunk as a single entry", () => {
        const entry = rpcEntry(1, thoughtLine("solo"));
        expect(groupAcpRpcLogEntries([entry])).toEqual([{ kind: "entry", entry }]);
    });

    it("splits runs when a non-thought line appears", () => {
        const ping = rpcEntry(2, JSON.stringify({ jsonrpc: "2.0", method: "ping" }));
        const entries = [rpcEntry(1, thoughtLine("a")), rpcEntry(3, thoughtLine("b"))];
        expect(groupAcpRpcLogEntries([entries[0]!, ping, entries[1]!])).toEqual([
            { kind: "entry", entry: entries[0]! },
            { kind: "entry", entry: ping },
            { kind: "entry", entry: entries[1]! },
        ]);
    });
});

describe("acpThoughtChunkPreview", () => {
    it("returns trimmed thought text", () => {
        expect(isAgentThoughtChunkLine(thoughtLine("hello"))).toBe(true);
        expect(acpThoughtChunkPreview(thoughtLine("  hello  \nworld"))).toBe("hello world");
    });
});

describe("prettyPrintAcpRpcJson", () => {
    it("formats scalar and json field blocks", () => {
        const line =
            '{"jsonrpc":"2.0","method":"session/prompt","params":{"prompt":"hello"},"id":2}';
        expect(prettyPrintAcpRpcJson(line)).toBe(
            [
                "title: session/prompt · hello",
                "",
                "id: 2",
                "",
                "method: session/prompt",
                "",
                "params:",
                "{",
                '  "prompt": "hello"',
                "}",
            ].join("\n"),
        );
    });

    it("returns the raw line when JSON parsing fails", () => {
        expect(prettyPrintAcpRpcJson("not-json")).toBe("not-json");
    });
});
