import { describe, expect, it } from "vite-plus/test";
import { acpSessionUpdateTitle, formatAcpRpcDisplay, prettyPrintAcpRpcJson } from "./acpRpcLog";

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
        expect(formatAcpRpcDisplay(line).title).toBe("tool_call · Write File");
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
            defaultCollapsed: true,
        });
    });

    it("returns raw text when JSON parsing fails", () => {
        expect(formatAcpRpcDisplay("not-json")).toEqual({ raw: "not-json" });
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
