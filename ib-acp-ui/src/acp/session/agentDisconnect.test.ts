import { describe, expect, it } from "vite-plus/test";
import {
    acpReconnectHint,
    describeAgentProcessExit,
    formatAgentConnectFailureMessage,
    formatAcpConnectionErrorMessage,
    formatAgentProcessExitMessage,
    isAcpConnectionStall,
    isAcpDisconnectError,
} from "./agentDisconnect";

describe("formatAgentProcessExitMessage", () => {
    it("explains exit code failures and includes stderr", () => {
        const message = formatAgentProcessExitMessage("Cursor", {
            code: 1,
            signal: null,
            stderrTail: "Error: auth token expired",
        });
        expect(message).toContain('Lost connection to ACP agent "Cursor".');
        expect(message).toContain("exited with an error (code 1)");
        expect(message).toContain(acpReconnectHint);
        expect(message).toContain("Error: auth token expired");
    });

    it("explains SIGTERM and exit code 143", () => {
        expect(
            formatAgentProcessExitMessage("Cursor", {
                code: 143,
                signal: null,
            }),
        ).toContain("terminated (SIGTERM");
        expect(describeAgentProcessExit({ code: null, signal: "SIGTERM" })).toContain("SIGTERM");
    });
});

describe("formatAgentConnectFailureMessage", () => {
    it("passes through spawn and config errors", () => {
        expect(
            formatAgentConnectFailureMessage(
                "Cursor",
                'Failed to spawn ACP agent "Cursor": cannot execute command "cursor" (ENOENT: ...).',
            ),
        ).toContain("Failed to spawn ACP agent");
        expect(
            formatAgentConnectFailureMessage(
                "Cursor",
                "No ACP agents configured. Browse the Agent Registry or add a manual ib-acp-ui.agents override.",
            ),
        ).toContain("No ACP agents configured");
    });

    it("adds recovery guidance for generic connection failures", () => {
        expect(formatAgentConnectFailureMessage("Cursor", "initialize timed out")).toContain(
            acpReconnectHint,
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
