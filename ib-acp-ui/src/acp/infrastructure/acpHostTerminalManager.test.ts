import { describe, expect, it } from "vite-plus/test";
import { createAcpHostTerminalManager } from "./acpHostTerminalManager";

describe("AcpHostTerminalManager", () => {
    it("runs a command and returns output and exit status", async () => {
        const host = createAcpHostTerminalManager({ getWorkspaceRoot: () => "/tmp" });
        const sessionId = "sess-test";
        const { terminalId } = await host.createTerminal({
            sessionId,
            command: process.execPath,
            args: ["-e", "process.stdout.write('hello\\n');"],
        });
        expect(terminalId).toMatch(/^term_/);

        await new Promise((resolve) => setTimeout(resolve, 200));

        const output = await host.terminalOutput({ sessionId, terminalId });
        expect(output.output).toContain("hello");
        expect(output.truncated).toBe(false);

        const exit = await host.waitForTerminalExit({ sessionId, terminalId });
        expect(exit.exitCode).toBe(0);

        await host.releaseTerminal({ sessionId, terminalId });
        host.dispose();
    });

    it("truncates retained output when outputByteLimit is exceeded", async () => {
        const host = createAcpHostTerminalManager({ getWorkspaceRoot: () => "/tmp" });
        const sessionId = "sess-trim";
        const line = "x".repeat(80);
        const { terminalId } = await host.createTerminal({
            sessionId,
            command: process.execPath,
            args: ["-e", `process.stdout.write(${JSON.stringify(line)})`],
            outputByteLimit: 32,
        });

        await new Promise((resolve) => setTimeout(resolve, 200));

        const output = await host.terminalOutput({ sessionId, terminalId });
        expect(Buffer.byteLength(output.output, "utf8")).toBeLessThanOrEqual(32);
        expect(output.truncated).toBe(true);
        expect(output.output).toMatch(/x+$/);

        await host.waitForTerminalExit({ sessionId, terminalId });
        await host.releaseTerminal({ sessionId, terminalId });
        host.dispose();
    });
});
