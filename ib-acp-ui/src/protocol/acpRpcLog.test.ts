import { describe, expect, it } from "vite-plus/test";
import { formatAcpRpcDisplay, prettyPrintAcpRpcJson } from "./acpRpcLog";

describe("formatAcpRpcDisplay", () => {
    it("extracts method and pretty-prints params", () => {
        const line = JSON.stringify({
            jsonrpc: "2.0",
            method: "session/update",
            params: {
                sessionId: "s1",
                update: { type: "agent_message_chunk", content: { text: "hi" } },
            },
        });
        expect(formatAcpRpcDisplay(line)).toEqual({
            method: "session/update",
            params: [
                "{",
                '  "sessionId": "s1",',
                '  "update": {',
                '    "type": "agent_message_chunk",',
                '    "content": {',
                '      "text": "hi"',
                "    }",
                "  }",
                "}",
            ].join("\n"),
        });
    });

    it("extracts result for responses", () => {
        const line = JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            result: { protocolVersion: 1 },
        });
        expect(formatAcpRpcDisplay(line)).toEqual({
            result: ["{", '  "protocolVersion": 1', "}"].join("\n"),
        });
    });

    it("returns raw text when JSON parsing fails", () => {
        expect(formatAcpRpcDisplay("not-json")).toEqual({ raw: "not-json" });
    });
});

describe("prettyPrintAcpRpcJson", () => {
    it("formats method and params blocks", () => {
        const line =
            '{"jsonrpc":"2.0","method":"session/prompt","params":{"prompt":"hello"},"id":2}';
        expect(prettyPrintAcpRpcJson(line)).toBe(
            ["method: session/prompt", "", "params:", "{", '  "prompt": "hello"', "}"].join("\n"),
        );
    });

    it("returns the raw line when JSON parsing fails", () => {
        expect(prettyPrintAcpRpcJson("not-json")).toBe("not-json");
    });
});
