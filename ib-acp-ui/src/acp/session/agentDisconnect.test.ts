import { describe, expect, it } from "vite-plus/test";
import {
    formatAcpConnectionErrorMessage,
    formatAgentProcessExitMessage,
    isAcpConnectionStall,
    isAcpDisconnectError,
} from "./agentDisconnect";

describe("formatAgentProcessExitMessage", () => {
    it("includes exit code and stderr tail", () => {
        expect(
            formatAgentProcessExitMessage("Cursor", {
                code: 1,
                signal: null,
                stderrTail: "Error: auth token expired",
            }),
        ).toBe('ACP agent "Cursor" stopped.\nExit code: 1.\nError: auth token expired');
    });

    it("includes signal when there is no exit code", () => {
        expect(formatAgentProcessExitMessage("Local", { code: null, signal: "SIGTERM" })).toBe(
            'ACP agent "Local" stopped.\nSignal: SIGTERM.',
        );
    });
});

describe("formatAcpConnectionErrorMessage", () => {
    it("rewrites opaque connection-closed errors", () => {
        expect(formatAcpConnectionErrorMessage("Cursor", "ACP connection closed")).toContain(
            'Lost connection to ACP agent "Cursor"',
        );
    });

    it("rewrites a retriable stall and keeps the session usable", () => {
        const raw = "Error: RetriableError: Connection stalled";
        expect(isAcpConnectionStall(raw)).toBe(true);
        expect(isAcpDisconnectError(raw)).toBe(false);
        expect(formatAcpConnectionErrorMessage("Cursor", raw)).toBe(
            "The connection stalled. Send a message to continue.",
        );
    });
});

describe("isAcpDisconnectError", () => {
    it("detects connection closed and agent-not-started errors", () => {
        expect(isAcpDisconnectError("ACP connection closed")).toBe(true);
        expect(isAcpDisconnectError("Agent not started")).toBe(true);
        expect(isAcpDisconnectError("Config change failed: timeout")).toBe(false);
    });
});
