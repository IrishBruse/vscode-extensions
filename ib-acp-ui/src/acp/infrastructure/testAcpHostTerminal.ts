import type { AcpHostTerminal } from "../ports/hostTerminal";

/** No-op terminal host for tests that never exercise `terminal/*`. */
export function createTestAcpHostTerminal(): AcpHostTerminal {
    return {
        createTerminal: async () => {
            throw new Error("createTerminal was not expected in this test");
        },
        terminalOutput: async () => {
            throw new Error("terminalOutput was not expected in this test");
        },
        waitForTerminalExit: async () => {
            throw new Error("waitForTerminalExit was not expected in this test");
        },
        killTerminal: async () => {
            throw new Error("killTerminal was not expected in this test");
        },
        releaseTerminal: async () => {
            throw new Error("releaseTerminal was not expected in this test");
        },
        dispose() {},
    };
}
