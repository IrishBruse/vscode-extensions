import { describe, expect, it } from "vite-plus/test";
import { prettyPrintAcpRpcJson } from "./acpRpcLog";

describe("prettyPrintAcpRpcJson", () => {
    it("pretty-prints valid JSON", () => {
        const line = '{"jsonrpc":"2.0","method":"session/prompt","id":2}';
        expect(prettyPrintAcpRpcJson(line)).toBe(
            ["{", '  "jsonrpc": "2.0",', '  "method": "session/prompt",', '  "id": 2', "}"].join(
                "\n",
            ),
        );
    });

    it("returns the raw line when JSON parsing fails", () => {
        expect(prettyPrintAcpRpcJson("not-json")).toBe("not-json");
    });
});
