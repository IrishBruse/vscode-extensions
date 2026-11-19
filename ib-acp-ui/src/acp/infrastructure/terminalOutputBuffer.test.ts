import { describe, expect, it } from "vite-plus/test";
import { truncateTerminalOutput } from "./terminalOutputBuffer";

describe("truncateTerminalOutput", () => {
    it("returns the string unchanged under the byte limit", () => {
        expect(truncateTerminalOutput("hello", 32)).toEqual({
            output: "hello",
            truncated: false,
        });
    });

    it("drops the oldest bytes on a UTF-8 character boundary", () => {
        const text = `start-${"✓".repeat(20)}-end`;
        const kept = truncateTerminalOutput(text, 24);
        expect(Buffer.byteLength(kept.output, "utf8")).toBeLessThanOrEqual(24);
        expect(kept.output.endsWith("-end")).toBe(true);
        expect(kept.truncated).toBe(true);
    });
});
