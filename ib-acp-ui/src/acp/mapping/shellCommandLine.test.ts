import { describe, expect, it } from "vite-plus/test";
import { extractShellCommandLine } from "./shellCommandLine";

describe("extractShellCommandLine", () => {
    it("reads Antigravity CommandLine objects and JSON strings", () => {
        expect(
            extractShellCommandLine({
                CommandLine: "ls -R .",
                WaitMsBeforeAsync: 2000,
                toolSummary: "List repository files",
            }),
        ).toBe("ls -R .");
        expect(
            extractShellCommandLine(
                '{"CommandLine":"ls -R .","WaitMsBeforeAsync":2000,"toolSummary":"List repository files"}',
            ),
        ).toBe("ls -R .");
    });

    it("keeps legacy command keys", () => {
        expect(extractShellCommandLine({ command: "npm test" })).toBe("npm test");
        expect(extractShellCommandLine("echo hello")).toBe("echo hello");
    });
});
