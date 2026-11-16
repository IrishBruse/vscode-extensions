/** Details from an agent subprocess exit event. */
export type AgentProcessExitDetails = {
    code: number | null;
    signal: NodeJS.Signals | string | null;
    stderrTail?: string;
};

/** Shown when the user can restore the link by prompting again or resetting the chat. */
export const acpReconnectHint =
    "Send a message to reconnect, or use /reset to start a new session.";

const SIGNAL_BY_NUMBER: Record<number, string> = {
    1: "SIGHUP",
    2: "SIGINT",
    9: "SIGKILL",
    15: "SIGTERM",
};

function describeNamedSignal(signal: string): string {
    switch (signal) {
        case "SIGTERM":
            return "terminated (SIGTERM — the process was asked to stop)";
        case "SIGKILL":
            return "killed (SIGKILL — the process was force-stopped)";
        case "SIGINT":
            return "interrupted (SIGINT)";
        case "SIGHUP":
            return "stopped (SIGHUP — the controlling terminal closed)";
        default:
            return `stopped by signal ${signal}`;
    }
}

function describeExitCode(code: number): string {
    if (code === 0) {
        return "exited cleanly (code 0) while the chat was still active";
    }
    const signalName = signalFromExitCode(code);
    if (signalName !== undefined) {
        return `${describeNamedSignal(signalName)} (exit code ${code})`;
    }
    if (code === 127) {
        return "exited because the agent command was not found (code 127)";
    }
    return `exited with an error (code ${code})`;
}

function signalFromExitCode(code: number): string | undefined {
    if (code <= 128 || code > 128 + 64) {
        return undefined;
    }
    const signalNumber = code - 128;
    return SIGNAL_BY_NUMBER[signalNumber] ?? `signal ${signalNumber}`;
}

/** User-facing explanation of why the agent subprocess stopped. */
export function describeAgentProcessExit(details: AgentProcessExitDetails): string {
    if (details.signal !== null && details.signal.length > 0) {
        if (details.code !== null) {
            return `${describeExitCode(details.code)} and ${describeNamedSignal(details.signal)}.`;
        }
        return `The agent process ${describeNamedSignal(details.signal)}.`;
    }
    if (details.code !== null) {
        return `The agent process ${describeExitCode(details.code)}.`;
    }
    return "The agent process stopped without reporting an exit code.";
}

/** Formats a user-facing message when the ACP agent process stops. */
export function formatAgentProcessExitMessage(
    agentName: string,
    details: AgentProcessExitDetails,
): string {
    const lines = [
        `Lost connection to ACP agent "${agentName}".`,
        describeAgentProcessExit(details),
        acpReconnectHint,
    ];
    const stderr = details.stderrTail?.trim();
    if (stderr !== undefined && stderr.length > 0) {
        lines.push(stderr);
    }
    return lines.join("\n");
}

/** True when a thrown/reported error means the ACP stdio connection is gone. */
export function isAcpDisconnectError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
        lower.includes("acp connection closed") ||
        lower.includes("active session disposed") ||
        message === "Agent not started"
    );
}

/** True when the agent link failed but the session can accept another message. */
export function isAcpConnectionStall(message: string): boolean {
    const lower = message.toLowerCase();
    return (
        lower.includes("connection stalled") ||
        lower.includes("retriableerror") ||
        lower.includes("econnreset") ||
        lower.includes("socket hang up") ||
        lower.includes("other side closed")
    );
}

/** Rewrites low-level connection errors into clearer text. */
export function formatAcpConnectionErrorMessage(agentName: string, detail: string): string {
    if (detail === "Agent session not connected.") {
        return `ACP agent "${agentName}" is not connected. ${acpReconnectHint}`;
    }
    if (detail === "Agent not started") {
        return `ACP agent "${agentName}" is not running. ${acpReconnectHint}`;
    }
    if (isAcpConnectionStall(detail)) {
        return "The connection stalled. Send a message to continue.";
    }
    if (isAcpDisconnectError(detail)) {
        return `Lost connection to ACP agent "${agentName}". The agent process may have stopped. ${acpReconnectHint}`;
    }
    return detail;
}

/** Formats a connect-time failure for display in the chat and session list. */
export function formatAgentConnectFailureMessage(agentName: string, detail: string): string {
    const trimmed = detail.trim();
    if (trimmed.length === 0) {
        return `Could not connect to ACP agent "${agentName}". ${acpReconnectHint}`;
    }
    if (
        trimmed.startsWith("Failed to spawn ACP agent") ||
        trimmed.startsWith("ACP protocol version mismatch") ||
        trimmed.startsWith("Authentication failed") ||
        trimmed.startsWith("No ACP agents configured")
    ) {
        return trimmed;
    }
    const rewritten = formatAcpConnectionErrorMessage(agentName, trimmed);
    if (rewritten !== trimmed) {
        return rewritten;
    }
    return `Could not connect to ACP agent "${agentName}". ${trimmed} ${acpReconnectHint}`;
}
